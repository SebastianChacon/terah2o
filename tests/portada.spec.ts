import { test, expect, request } from "@playwright/test";

/**
 * Portada de terah2o.com: presentación + accesos principales.
 *
 * Opt-in igual que dominios.spec.ts: golpea terah2o.com y los despliegues de
 * las tres herramientas. PORTADA_URL permite apuntarla a un preview, donde la
 * portada vive en /presentacion:
 *
 *   DOMAIN_TESTS=1 npm run test:e2e -- portada.spec.ts
 *   PORTADA_URL=http://localhost:3000/presentacion DOMAIN_TESTS=1 npm run test:e2e -- portada.spec.ts
 */
const PORTADA = process.env.PORTADA_URL || "https://terah2o.com/";
const APP = process.env.APP_URL || "https://app.terah2o.com";

const HERRAMIENTAS = [
  { nombre: /simulador/i, href: "/simulador" },
  { nombre: /filtro de arena/i, href: "/filtro-de-agua" },
  { nombre: /gradiente/i, href: "/gradiente" },
];

test.skip(!process.env.DOMAIN_TESTS, "requiere DOMAIN_TESTS=1");

test.describe("Portada — accesos principales", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PORTADA);
  });

  for (const { nombre, href } of HERRAMIENTAS) {
    test(`${href} existe y abre en pestaña nueva con noopener`, async ({ page }) => {
      const link = page.locator(`#accesos a[href="${href}"]`);
      await expect(link).toHaveCount(1);
      await expect(link).toContainText(nombre);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    });
  }

  test("el acceso al sistema apunta a la app, en la misma pestaña", async ({ page }) => {
    const link = page.locator(`#accesos a[href="${APP}"]`);
    await expect(link).toHaveCount(1);
    await expect(link).not.toHaveAttribute("target", "_blank");
  });

  test("dimensionamiento aparece como Próximamente, sin enlace", async ({ page }) => {
    const tarjeta = page.locator("#accesos li", { hasText: /dimensionamiento/i });
    await expect(tarjeta).toContainText(/próximamente/i);
    await expect(tarjeta.locator("a")).toHaveCount(0);
  });

  test("el brochure se descarga y es un PDF real", async ({ page }) => {
    const link = page.locator('a[href$=".pdf"]').first();
    await expect(link).toHaveAttribute("download", /.*/);
    const ctx = await request.newContext();
    const res = await ctx.get(new URL((await link.getAttribute("href"))!, PORTADA).toString());
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("pdf");
    await ctx.dispose();
  });

  test("ningún enlace apunta a '#' o a vacío", async ({ page }) => {
    await expect(page.locator('a[href="#"], a[href=""], a:not([href])')).toHaveCount(0);
  });
});

test.describe("Portada — los destinos responden", () => {
  test("las tres herramientas devuelven 200 y no un 404 de Vercel", async () => {
    const ctx = await request.newContext();
    for (const { href } of HERRAMIENTAS) {
      const res = await ctx.get(new URL(href, PORTADA).toString());
      expect(res.status(), `${href} debe responder 200`).toBe(200);
      expect(await res.text(), href).not.toContain("DEPLOYMENT_NOT_FOUND");
    }
    await ctx.dispose();
  });
});
