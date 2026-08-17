import { test, expect } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";

// Usuario de prueba creado en Clerk Dashboard (Paso 0.3)
// TEST_PASSWORD en env para login manual; E2E usa sign-in tokens (Client Trust bypass)
const TEST_EMAIL = process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";

test.describe("login flow (Clerk)", () => {
  test.beforeEach(async ({ context }) => {
    // Estado limpio antes de cada test
    await context.clearCookies();
  });

  // ── Test 1: página de login carga correctamente ──────────────────────────
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  // ── Test 2: contraseña incorrecta muestra error ──────────────────────────
  test("wrong password shows error and stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill("contraseña-incorrecta-xyz");
    await page.locator("button[type='submit']").click();

    // Esperar error (Clerk responde en ~2-4s). Se apunta al banner por testid:
    // un locator por texto también engancha el label "Contraseña" y el enlace
    // "¿Olvidaste tu contraseña?", y pasaría sin que haya error real.
    const error = page.getByTestId("auth-error");
    await expect(error).toBeVisible({ timeout: 8000 });
    await expect(error).toContainText(/contraseña|credencial|error/i);
    expect(page.url()).toContain("/login");
  });

  // ── Test 3: login exitoso → ruta protegida + cookie Clerk ───────────────
  test("successful login reaches protected route", async ({ page }) => {
    await loginWithClerkTicket(page, TEST_EMAIL);

    const finalUrl = page.url();
    console.log("Final URL:", finalUrl);
    expect(finalUrl).not.toContain("/login");
    expect(finalUrl).toMatch(/\/(operaciones|dashboard|asistencia|academia)/);

    // Verificar que Clerk estableció su cookie de sesión
    const cookies = await page.context().cookies();
    const clerkCookie = cookies.find(
      (c) => c.name === "__session" || c.name.startsWith("__clerk") || c.name === "__client_uat"
    );
    console.log("Cookies:", cookies.map((c) => c.name).join(", "));
    expect(clerkCookie, "Clerk session cookie debe estar presente").toBeTruthy();
  });

  // ── Test 4: usuario autenticado en /login → redirige a /operaciones ──────
  test("authenticated user visiting /login is redirected", async ({ page }) => {
    await loginWithClerkTicket(page, TEST_EMAIL);
    expect(page.url()).not.toContain("/login");

    // Intentar volver a /login — proxy.ts debe redirigir
    await page.goto("/login");
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("/login");
  });

  // ── Test 5: usuario no autenticado bloqueado en rutas protegidas ─────────
  test("unauthenticated user is blocked from /operaciones", async ({ page }) => {
    await page.goto("/operaciones");
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });

  // ── Test 6: sign out limpia sesión y redirige a /login ───────────────────
  test("sign out clears session", async ({ page }) => {
    await loginWithClerkTicket(page, TEST_EMAIL);

    // Cerrar sesión vía Clerk (NavbarUser requiere perfil Convex sincronizado)
    await page.evaluate(async () => {
      await (window as unknown as { Clerk: { signOut: () => Promise<void> } }).Clerk.signOut();
    });

    await page.goto("/operaciones");
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });
});
