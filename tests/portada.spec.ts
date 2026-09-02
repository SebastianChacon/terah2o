import { test, expect, request } from "@playwright/test";

/**
 * Botones de herramientas en la portada (Fase 2 del plan).
 *
 * Opt-in igual que dominios.spec.ts — golpea www.terah2o.com y los despliegues
 * de las tres herramientas.
 *
 *   DOMAIN_TESTS=1 npm run test:e2e -- portada.spec.ts
 */
// Overridables para poder verificar la portada ANTES del corte de dominio:
//   PORTADA_URL=http://localhost:4173 APP_URL=https://terah2o.vercel.app DOMAIN_TESTS=1 ...
// Sin ellas apuntan a la estructura final (www = portada, app = SaaS).
const WWW = process.env.PORTADA_URL || "https://www.terah2o.com";
const APP = process.env.APP_URL || "https://app.terah2o.com";
// Origen que resuelve los rewrites de las herramientas. En producción es el
// mismo WWW; antes del corte de dominio se apunta al proyecto Next que ya los
// tiene (TOOLS_ORIGIN=http://localhost:3010).
const TOOLS = process.env.TOOLS_ORIGIN || WWW;

// Rutas del propio dominio, no los *.vercel.app: los rewrites (next.config.ts
// para el proyecto Next, portada/vercel.json para el de la portada) las sirven
// desde los despliegues de las herramientas sin sacar al visitante del dominio.
const HERRAMIENTAS = [
  { nombre: /simulador/i, href: "/simulador" },
  { nombre: /filtros/i, href: "/filtro-de-agua" },
  { nombre: /gradiente/i, href: "/gradiente" },
];

test.skip(!process.env.DOMAIN_TESTS, "requiere DOMAIN_TESTS=1");

test.describe("Portada — botones de herramientas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WWW);
  });

  for (const { nombre, href } of HERRAMIENTAS) {
    test(`el botón ${href} existe, apunta bien y abre en pestaña nueva`, async ({ page }) => {
      const link = page.locator(`a[href^="${href}"]`);
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("target", "_blank");
      // rel debe traer noopener: sin él, la página destino puede manipular window.opener
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(link).toContainText(nombre);
    });
  }

  test("el botón del motor apunta al subdominio de la app, en el mismo tab", async ({ page }) => {
    const link = page.locator('a[href*="app.terah2o.com/motor-inteligencia"]');
    await expect(link).toHaveCount(1);
    await expect(link).not.toHaveAttribute("target", "_blank");
  });

  test("el brochure se descarga y es un PDF real", async ({ page }) => {
    const link = page.locator('a[href$=".pdf"]');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("download", /.*/);

    const ctx = await request.newContext();
    const href = await link.getAttribute("href");
    const res = await ctx.get(new URL(href!, WWW).toString());
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
    await ctx.dispose();
  });

  test("dimensionamiento todavía NO aparece como herramienta (él dijo que no está listo)", async ({ page }) => {
    // Scoped a la grilla de herramientas: "Dimensionamientos preliminares" sí existe
    // como servicio (sección Servicios, footer y el select de contacto) y eso es correcto.
    // Lo que no debe existir todavía es la tarjeta-herramienta con su botón "Abrir".
    await expect(
      page.locator(".tools-grid .tool", { hasText: /dimensionamiento/i }),
    ).toHaveCount(0);
  });

  test("ningún enlace de la portada apunta a '#' o a vacío", async ({ page }) => {
    const rotos = page.locator('a[href="#"], a[href=""], a:not([href])');
    await expect(rotos).toHaveCount(0);
  });
});

test.describe("Portada — los destinos responden", () => {
  test("las tres herramientas devuelven 200 y no una página de error de Vercel", async () => {
    const ctx = await request.newContext();
    for (const { href } of HERRAMIENTAS) {
      const res = await ctx.get(new URL(href, TOOLS).toString());
      expect(res.status(), `${href} debe responder 200`).toBe(200);
      const html = await res.text();
      expect(html, `${href} no debe ser un 404 de Vercel`).not.toContain("DEPLOYMENT_NOT_FOUND");
    }
    await ctx.dispose();
  });

  test("el motor exige login para un anónimo (comportamiento actual, opción (a))", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`${APP}/motor-inteligencia`);
    await page.waitForURL(/\/login|\/pricing/, { timeout: 20000 });
  });
});
