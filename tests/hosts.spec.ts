import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";

/**
 * Enrutado por dominio en src/proxy.ts (ver PLAN-app-y-portada.md).
 *
 * Corre contra cualquier servidor (local o preview) simulando el dominio con
 * la cabecera Host: no necesita DNS ni los dominios reales.
 *
 *   npx playwright test tests/hosts.spec.ts
 */
const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

async function as(host: string): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { host },
    maxRedirects: 0,
  });
}

test.describe("terah2o.com (portada)", () => {
  let ctx: APIRequestContext;
  test.beforeAll(async () => (ctx = await as("terah2o.com")));
  test.afterAll(async () => ctx.dispose());

  test("/ sirve la presentación con los accesos, sin redirigir", async () => {
    const res = await ctx.get("/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="accesos"');
    expect(html).toContain("Próximamente");
    expect(html).toContain('rel="canonical" href="https://terah2o.com/"');
  });

  test("/presentacion redirige a / (una sola URL para la portada)", async () => {
    const res = await ctx.get("/presentacion");
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe("https://terah2o.com/");
  });

  for (const ruta of ["/operaciones", "/asistencia", "/login?next=%2Facademia", "/pricing", "/api/gemini"]) {
    test(`${ruta} redirige 308 a la app conservando la ruta`, async () => {
      const res = await ctx.get(ruta);
      expect(res.status()).toBe(308);
      expect(res.headers()["location"]).toBe(`https://app.terah2o.com${ruta}`);
    });
  }

  test("la portada no se instala: sin manifest ni service worker", async () => {
    expect((await ctx.get("/manifest.webmanifest")).status()).toBe(404);
    expect((await ctx.get("/sw.js")).status()).toBe(404);
  });

  test("el brochure y los íconos se sirven en la portada", async () => {
    expect((await ctx.get("/TERAH2O-Brochure.pdf")).status()).toBe(200);
    expect((await ctx.get("/icons/icon-192.png")).status()).toBe(200);
  });
});

test("www.terah2o.com redirige a terah2o.com conservando la ruta", async () => {
  const ctx = await as("www.terah2o.com");
  const res = await ctx.get("/gradiente?x=1");
  expect(res.status()).toBe(308);
  expect(res.headers()["location"]).toBe("https://terah2o.com/gradiente?x=1");
  await ctx.dispose();
});

test.describe("app.terah2o.com (sistema)", () => {
  let ctx: APIRequestContext;
  test.beforeAll(async () => (ctx = await as("app.terah2o.com")));
  test.afterAll(async () => ctx.dispose());

  test("/ sirve el inicio del sistema sin el botón de presentación", async () => {
    const res = await ctx.get("/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("INTELIGENCIA OPERATIVA");
    expect(html).toContain('href="/operaciones"');
    expect(html).not.toContain("Presentación institucional");
    expect(html).not.toContain('href="/presentacion"');
  });

  test("/presentacion redirige a la portada", async () => {
    const res = await ctx.get("/presentacion");
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe("https://terah2o.com/");
  });

  test("las rutas protegidas siguen pidiendo login", async () => {
    const res = await ctx.get("/operaciones");
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toContain("/login");
  });
});

test("en otros hosts (previews, localhost) la portada se ve en /presentacion", async () => {
  const ctx = await pwRequest.newContext({ baseURL: BASE, maxRedirects: 0 });
  const res = await ctx.get("/presentacion");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('id="accesos"');
  await ctx.dispose();
});
