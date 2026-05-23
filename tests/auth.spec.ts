import { test, expect } from "@playwright/test";

// Usuario de prueba creado en Clerk Dashboard (Paso 0.3)
const TEST_EMAIL = process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "segura1234";

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

    // Esperar error (Clerk responde en ~2-4s)
    const error = page.locator("text=/contraseña|credencial|error/i");
    await expect(error).toBeVisible({ timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  // ── Test 3: login exitoso → ruta protegida + cookie Clerk ───────────────
  test("successful login reaches protected route", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill(TEST_PASSWORD);

    await Promise.all([
      page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 20000 }),
      page.locator("button[type='submit']").click(),
    ]);

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
    // Login
    await page.goto("/login");
    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill(TEST_PASSWORD);
    await Promise.all([
      page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 20000 }),
      page.locator("button[type='submit']").click(),
    ]);
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
    // Login
    await page.goto("/login");
    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill(TEST_PASSWORD);
    await Promise.all([
      page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 20000 }),
      page.locator("button[type='submit']").click(),
    ]);

    // Abrir menú de usuario y cerrar sesión
    const userChip = page.locator("button[aria-label='Menú de usuario']");
    await userChip.waitFor({ timeout: 10000 });
    await userChip.click();

    const signOutBtn = page.locator("text=Cerrar Sesión");
    await expect(signOutBtn).toBeVisible({ timeout: 4000 });

    await Promise.all([
      page.waitForURL(/login/, { timeout: 10000 }),
      signOutBtn.click(),
    ]);

    expect(page.url()).toContain("/login");

    // Intentar acceder a ruta protegida → debe redirigir a login
    await page.goto("/operaciones");
    await expect(page).toHaveURL(/login/, { timeout: 8000 });
  });
});
