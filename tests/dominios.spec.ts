import { test, expect, request } from "@playwright/test";

/**
 * Verificación de la reestructura de dominio (Fase 1 del plan).
 *
 * Opt-in: solo corre con DOMAIN_TESTS=1, porque golpea los dominios reales en
 * producción. Sin la variable, toda la suite se salta y no estorba al desarrollo
 * local.
 *
 *   DOMAIN_TESTS=1 npm run test:e2e -- dominios.spec.ts
 */
const APP = "https://app.terah2o.com";
const WWW = "https://www.terah2o.com";
const APEX = "https://terah2o.com";

test.skip(!process.env.DOMAIN_TESTS, "requiere DOMAIN_TESTS=1");

test.describe("Dominios", () => {
  test("app.terah2o.com sirve el Next.js y no la portada", async ({ page }) => {
    await page.goto(APP);
    await expect(page.locator("text=INTELIGENCIA OPERATIVA")).toBeVisible();
  });

  test("www.terah2o.com sirve la portada estática", async ({ page }) => {
    const res = await page.goto(WWW);
    expect(res?.status()).toBe(200);
    // La portada NO debe cargar el bundle de Next.js
    await expect(page.locator("script[src*='/_next/']")).toHaveCount(0);
  });

  test("el apex redirige a www", async () => {
    const ctx = await request.newContext({ maxRedirects: 0 });
    const res = await ctx.get(APEX);
    expect([301, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("www.terah2o.com");
    await ctx.dispose();
  });

  test("los tres dominios sirven HTTPS con certificado válido", async () => {
    // newContext falla ante un certificado inválido salvo ignoreHTTPSErrors
    const ctx = await request.newContext({ ignoreHTTPSErrors: false });
    for (const url of [APP, WWW, APEX]) {
      const res = await ctx.get(url);
      expect(res.status(), `${url} debe responder`).toBeLessThan(400);
    }
    await ctx.dispose();
  });

  test("terah2o.vercel.app sigue vivo (no romper enlaces viejos)", async () => {
    const ctx = await request.newContext();
    const res = await ctx.get("https://terah2o.vercel.app");
    expect(res.status()).toBeLessThan(400);
    await ctx.dispose();
  });
});

test.describe("Auth sobre el dominio nuevo (regresión de Clerk)", () => {
  test("una ruta protegida sin sesión redirige a /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`${APP}/operaciones`);
    await page.waitForURL(/\/login/, { timeout: 20000 });
    expect(page.url()).toContain("/login");
  });

  test("/login carga el formulario de Clerk en el dominio nuevo", async ({ page }) => {
    await page.goto(`${APP}/login`);
    await expect(page.getByTestId("password-input")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("forgot-password-link")).toBeVisible();
  });
});
