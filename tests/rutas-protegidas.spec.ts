import { test, expect, request as pwRequest, type APIRequestContext } from "@playwright/test";

/**
 * Contrato de enrutamiento para un visitante ANÓNIMO.
 *
 * Nace de un bug real de producción: `www.terah2o.com/operaciones` devolvía 404
 * en vez del login. Clerk lo explicaba en la respuesta:
 *
 *     x-clerk-auth-reason: protect-rewrite, dev-browser-missing
 *     x-clerk-auth-status: signed-out
 *
 * `auth.protect()` delega en el handshake de Clerk; con una instancia de
 * desarrollo (pk_test) sobre un dominio real ese handshake no se completa y
 * Clerk reescribe a 404. No se reproducía en local porque en localhost la
 * cookie de dev-browser sí existe. De ahí que esta suite corra contra un
 * baseURL configurable: sirve para local y para un despliegue.
 *
 *   npx playwright test tests/rutas-protegidas.spec.ts
 *   PLAYWRIGHT_BASE_URL=https://www.terah2o.com npx playwright test tests/rutas-protegidas.spec.ts
 *
 * `x-vercel-protection-bypass` se envía si está en el entorno, para poder
 * correrla contra un preview protegido con SSO.
 */

const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

/** Páginas que exigen sesión. Anónimo debe ver el login, nunca un 404. */
const PAGINAS_PROTEGIDAS = [
  "/operaciones",
  "/operaciones/bitacora",
  "/operaciones/consola-tecnica",
  "/operaciones/finanzas",
  "/operaciones/hoja-operativa",
  "/operaciones/stock",
  "/asistencia",
  "/academia",
  "/motor-inteligencia",
  "/dashboard/profile",
  "/dashboard/admin",
  "/owner",
];

/** Páginas abiertas: son la puerta de entrada, deben responder 200 sin sesión. */
const PAGINAS_PUBLICAS = ["/", "/login", "/pricing"];

/**
 * APIs que exigen sesión. Un 404 aquí miente sobre la existencia del endpoint;
 * el contrato correcto para un cliente sin sesión es 401.
 */
const APIS_PROTEGIDAS = [
  "/api/admin/create-operator",
  "/api/admin/delete-operator",
  "/api/admin/invite-admin",
  "/api/admin/update-permissions",
  "/api/owner/create-client",
  "/api/owner/delete-org",
  "/api/owner/delete-user",
];

/**
 * Herramientas de cálculo servidas bajo el dominio vía rewrite. El marcador es
 * un trozo del HTML del origen, para distinguir "llegó la herramienta" de
 * "llegó cualquier 200" — un 404 de Next también responde 200 en algunos casos.
 */
const HERRAMIENTAS = [
  { ruta: "/filtro-de-agua", marcador: /filtro de arena/i },
  { ruta: "/gradiente", marcador: /<x-dc>|support\.js/i },
  { ruta: "/simulador", marcador: /simulador/i },
];

function extraHeaders() {
  return BYPASS ? { "x-vercel-protection-bypass": BYPASS } : undefined;
}

let ctx: APIRequestContext;

test.beforeAll(async ({ playwright }) => {
  ctx = await pwRequest.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    extraHTTPHeaders: extraHeaders(),
  });
  void playwright;
});

test.afterAll(async () => {
  await ctx?.dispose();
});

test.describe("Anónimo — páginas protegidas mandan al login", () => {
  for (const ruta of PAGINAS_PROTEGIDAS) {
    test(`${ruta} redirige a /login y NO da 404`, async () => {
      const res = await ctx.get(ruta, { maxRedirects: 0 });

      // El fallo original: 404 con x-clerk-auth-reason: dev-browser-missing.
      expect(
        res.status(),
        `${ruta} devolvió ${res.status()}. Un 404 aquí es el bug de Clerk ` +
          `dev-browser-missing (headers: ${JSON.stringify(res.headers()["x-clerk-auth-reason"])})`,
      ).not.toBe(404);

      expect([301, 302, 303, 307, 308]).toContain(res.status());

      const location = res.headers()["location"] ?? "";
      expect(location, `${ruta} debe apuntar a /login`).toContain("/login");
      expect(
        location,
        `${ruta} debe conservar el destino para volver tras el login`,
      ).toContain("redirect_url");
    });
  }
});

test.describe("Anónimo — páginas públicas responden", () => {
  for (const ruta of PAGINAS_PUBLICAS) {
    test(`${ruta} responde 200 sin sesión`, async () => {
      const res = await ctx.get(ruta);
      expect(res.status(), `${ruta} debe ser accesible sin cuenta`).toBe(200);
    });
  }
});

test.describe("Anónimo — APIs protegidas responden 401, no 404", () => {
  for (const ruta of APIS_PROTEGIDAS) {
    test(`${ruta} responde 401`, async () => {
      const res = await ctx.post(ruta, { data: {}, failOnStatusCode: false });
      expect(
        res.status(),
        `${ruta} devolvió ${res.status()}; un 404 oculta que el endpoint existe`,
      ).toBe(401);
    });
  }
});

test.describe("Herramientas servidas bajo el dominio", () => {
  for (const { ruta, marcador } of HERRAMIENTAS) {
    test(`${ruta} sirve la herramienta, sin pedir login`, async () => {
      const res = await ctx.get(ruta);
      expect(res.status(), `${ruta} debe responder 200`).toBe(200);

      const html = await res.text();
      expect(html, `${ruta} no debe ser un 404 de Vercel`).not.toContain(
        "DEPLOYMENT_NOT_FOUND",
      );
      expect(html, `${ruta} debe traer el HTML de la herramienta`).toMatch(marcador);
    });
  }

  test("/support.js sirve el runtime que necesita el gradiente", async () => {
    const res = await ctx.get("/support.js");
    expect(res.status()).toBe(200);
    // Sin este archivo el gradiente renderiza en blanco: su HTML lo pide como
    // "./support.js", que en /gradiente resuelve a /support.js.
    expect((await res.text()).length).toBeGreaterThan(1000);
  });
});
