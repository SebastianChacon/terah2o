import { test, expect } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";
import { seedTestData } from "./helpers/seed-test-data";

/**
 * Gate de suscripción (proxy.ts):
 *   - Un usuario AUTENTICADO pero SIN plan ("none" / "past_due" / "canceled")
 *     NO debe acceder a ninguna página protegida → es redirigido a /pricing.
 *   - Un usuario CON plan ("active" / "trialing") accede normalmente.
 *
 * El gate se aplica en el proxy leyendo la cookie `__convexSubStatus`. Estos
 * tests la fijan explícitamente para validar el enforcement de forma
 * determinista (es exactamente la señal que escribe useSubscription en el
 * cliente). El usuario carlos está sembrado como `trialing pro`, así que para
 * simular "sin plan" sobreescribimos la cookie tras autenticar.
 */

const TEST_EMAIL = process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Rutas protegidas representativas (hub + sub-módulos + dashboard).
const PROTECTED_ROUTES = [
  "/operaciones",
  "/operaciones/stock",
  "/operaciones/finanzas",
  "/asistencia",
  "/academia",
  "/dashboard/profile",
];

async function setSubCookie(
  page: import("@playwright/test").Page,
  value: string
) {
  await page.context().addCookies([
    {
      name: "__convexSubStatus",
      value,
      url: BASE_URL,
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

test.describe("gate de suscripción — sin plan no hay acceso", () => {
  test.beforeAll(async () => {
    // Garantiza que carlos exista (admin + org). El plan se sobreescribe por cookie.
    await seedTestData(TEST_EMAIL);
  });

  // ── 1. Sin sesión → /login (el gate de auth corre antes que el de plan) ─────
  test("usuario no autenticado es enviado a /login", async ({ page }) => {
    await page.goto("/operaciones");
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  // ── 2. Autenticado SIN plan ("none") → bloqueado en cada ruta → /pricing ────
  test("autenticado sin plan (none) es redirigido a /pricing en todas las rutas", async ({
    page,
  }) => {
    await loginWithClerkTicket(page, TEST_EMAIL);
    await setSubCookie(page, "none");

    for (const route of PROTECTED_ROUTES) {
      await page.goto(route);
      await expect(page, `ruta ${route} debe redirigir a /pricing`).toHaveURL(
        /\/pricing/,
        { timeout: 8000 }
      );
    }
  });

  // ── 3. Estados de plan inactivo también bloquean ───────────────────────────
  for (const status of ["past_due", "canceled"]) {
    test(`autenticado con plan "${status}" es redirigido a /pricing`, async ({
      page,
    }) => {
      await loginWithClerkTicket(page, TEST_EMAIL);
      await setSubCookie(page, status);

      await page.goto("/operaciones");
      await expect(page).toHaveURL(/\/pricing/, { timeout: 8000 });
    });
  }

  // ── 4. /owner está exento del gate de plan (requiere login, no suscripción) ─
  test("/owner no es bloqueado por el gate de plan", async ({ page }) => {
    await loginWithClerkTicket(page, TEST_EMAIL);
    await setSubCookie(page, "none");

    await page.goto("/owner");
    // No debe rebotar a /pricing; carlos verá la UI de acceso denegado (no es
    // super-admin) pero la URL permanece en /owner.
    await page.waitForTimeout(1500);
    await expect(page).not.toHaveURL(/\/pricing/);
    expect(page.url()).toContain("/owner");
  });
});

test.describe("gate de suscripción — con plan hay acceso", () => {
  test.beforeAll(async () => {
    await seedTestData(TEST_EMAIL); // carlos queda como trialing pro
  });

  // ── 5. Plan "active" (cookie explícita) → acceso a cada ruta ───────────────
  test("autenticado con plan activo accede a las rutas protegidas", async ({
    page,
  }) => {
    await loginWithClerkTicket(page, TEST_EMAIL);
    await setSubCookie(page, "active");

    for (const route of PROTECTED_ROUTES) {
      await page.goto(route);
      await expect(
        page,
        `ruta ${route} debe ser accesible con plan activo`
      ).toHaveURL(new RegExp(route.replace(/\//g, "\\/")), { timeout: 8000 });
      await expect(page).not.toHaveURL(/\/pricing/);
      await expect(page).not.toHaveURL(/\/login/);
    }
  });

  // ── 6. Flujo real: login con suscripción sembrada (trialing) → entra a la app ─
  test("login con suscripción trialing sembrada aterriza dentro de la app", async ({
    page,
  }) => {
    await loginWithClerkTicket(page, TEST_EMAIL);

    // Tras login con plan activo, LoginContent enruta al destino (no a /pricing).
    await expect(page).toHaveURL(
      /\/(operaciones|asistencia|academia|dashboard)/,
      { timeout: 12000 }
    );
    await expect(page).not.toHaveURL(/\/login/);
  });
});
