import { test, expect, request } from "@playwright/test";

/**
 * Botones de herramientas en la portada (Fase 2 del plan).
 *
 * Opt-in igual que dominios.spec.ts — golpea www.terah2o.com y los despliegues
 * de las tres herramientas.
 *
 *   DOMAIN_TESTS=1 npm run test:e2e -- portada.spec.ts
 */
const WWW = "https://www.terah2o.com";

const HERRAMIENTAS = [
  { nombre: /simulador/i, href: "https://simulador-neon.vercel.app" },
  { nombre: /filtros/i, href: "https://filtros-de-arena.vercel.app" },
  { nombre: /gradiente/i, href: "https://calculadora-gradiente.vercel.app" },
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

  test("dimensionamiento todavía NO aparece (él dijo que no está listo)", async ({ page }) => {
    await expect(page.locator("text=/dimensionamiento/i")).toHaveCount(0);
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
      const res = await ctx.get(href);
      expect(res.status(), `${href} debe responder 200`).toBe(200);
      const html = await res.text();
      expect(html, `${href} no debe ser un 404 de Vercel`).not.toContain("DEPLOYMENT_NOT_FOUND");
    }
    await ctx.dispose();
  });

  test("el motor exige login para un anónimo (comportamiento actual, opción (a))", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("https://app.terah2o.com/motor-inteligencia");
    await page.waitForURL(/\/login|\/pricing/, { timeout: 20000 });
  });
});
