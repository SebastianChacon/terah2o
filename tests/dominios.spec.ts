import { test, expect, request } from "@playwright/test";

/**
 * Verificación del mapa de dominios en producción (ver PLAN-app-y-portada.md).
 *
 *   terah2o.com      → portada (presentación + accesos)
 *   www.terah2o.com  → 308 a terah2o.com
 *   app.terah2o.com  → el sistema, instalable como app
 *
 * Opt-in: solo corre con DOMAIN_TESTS=1, porque golpea los dominios reales.
 *
 *   DOMAIN_TESTS=1 npm run test:e2e -- dominios.spec.ts
 */
const APP = "https://app.terah2o.com";
const PORTADA = "https://terah2o.com";
const WWW = "https://www.terah2o.com";

test.skip(!process.env.DOMAIN_TESTS, "requiere DOMAIN_TESTS=1");

test.describe("Dominios", () => {
  test("app.terah2o.com sirve el inicio del sistema", async ({ page }) => {
    await page.goto(APP);
    await expect(page.locator("text=INTELIGENCIA OPERATIVA")).toBeVisible();
    await expect(page.getByRole("link", { name: "Operaciones" })).toBeVisible();
    await expect(page.getByText("Presentación institucional")).toHaveCount(0);
  });

  test("terah2o.com sirve la portada con los accesos", async ({ page }) => {
    const res = await page.goto(PORTADA);
    expect(res?.status()).toBe(200);
    expect(page.url()).toBe(`${PORTADA}/`);
    await expect(page.locator("#accesos")).toBeVisible();
  });

  test("www redirige a terah2o.com conservando la ruta", async () => {
    const ctx = await request.newContext({ maxRedirects: 0 });
    const res = await ctx.get(`${WWW}/gradiente`);
    expect([301, 308]).toContain(res.status());
    expect(res.headers()["location"]).toBe(`${PORTADA}/gradiente`);
    await ctx.dispose();
  });

  test("los módulos en terah2o.com redirigen a la app", async () => {
    const ctx = await request.newContext({ maxRedirects: 0 });
    for (const ruta of ["/operaciones", "/login", "/pricing"]) {
      const res = await ctx.get(`${PORTADA}${ruta}`);
      expect(res.status(), ruta).toBe(308);
      expect(res.headers()["location"], ruta).toBe(`${APP}${ruta}`);
    }
    await ctx.dispose();
  });

  test("app.terah2o.com/presentacion redirige a la portada", async () => {
    const ctx = await request.newContext({ maxRedirects: 0 });
    const res = await ctx.get(`${APP}/presentacion`);
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe(`${PORTADA}/`);
    await ctx.dispose();
  });

  test("solo la app publica manifest", async () => {
    const ctx = await request.newContext();
    expect((await ctx.get(`${APP}/manifest.webmanifest`)).status()).toBe(200);
    expect((await ctx.get(`${PORTADA}/manifest.webmanifest`)).status()).toBe(404);
    await ctx.dispose();
  });

  test("los tres dominios sirven HTTPS con certificado válido", async () => {
    const ctx = await request.newContext({ ignoreHTTPSErrors: false });
    for (const url of [APP, PORTADA, WWW]) {
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

test.describe("Auth sobre la app (regresión de Clerk)", () => {
  test("una ruta protegida sin sesión redirige a /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`${APP}/operaciones`);
    await page.waitForURL(/\/login/, { timeout: 20000 });
  });

  test("/login carga el formulario de Clerk", async ({ page }) => {
    await page.goto(`${APP}/login`);
    await expect(page.getByTestId("password-input")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("forgot-password-link")).toBeVisible();
  });
});
