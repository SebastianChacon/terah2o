import { test, expect } from "@playwright/test";

// Número único de contacto de la empresa (debe coincidir con WHATSAPP_NUMBER en src/lib/constants.ts).
const WHATSAPP_NUMBER = "16084489126";

test.describe("WhatsApp FAB — home pública", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("el botón flotante de WhatsApp es visible", async ({ page }) => {
    const fab = page.getByTestId("whatsapp-fab");
    await expect(fab).toBeVisible({ timeout: 10000 });
    await expect(fab).toHaveAttribute("aria-label", "WhatsApp");
  });

  test("apunta al número correcto en formato wa.me", async ({ page }) => {
    const fab = page.getByTestId("whatsapp-fab");
    const href = await fab.getAttribute("href");
    expect(href).toContain(`https://wa.me/${WHATSAPP_NUMBER}`);
  });

  test("abre en pestaña nueva con rel seguro", async ({ page }) => {
    const fab = page.getByTestId("whatsapp-fab");
    await expect(fab).toHaveAttribute("target", "_blank");
    await expect(fab).toHaveAttribute("rel", /noopener/);
  });

  test("incluye mensaje pre-llenado", async ({ page }) => {
    const fab = page.getByTestId("whatsapp-fab");
    const href = await fab.getAttribute("href");
    expect(href).toContain("?text=");
  });

  test("el número del footer enlaza a WhatsApp", async ({ page }) => {
    const footerLink = page.getByRole("link", { name: /608.*448.*9126/ });
    await expect(footerLink).toBeVisible();
    const href = await footerLink.getAttribute("href");
    expect(href).toContain(`https://wa.me/${WHATSAPP_NUMBER}`);
  });
});

test.describe("WhatsApp FAB — global", () => {
  test("aparece en /login (montado en el layout)", async ({ page }) => {
    await page.goto("/login");
    const fab = page.getByTestId("whatsapp-fab");
    await expect(fab).toBeVisible({ timeout: 10000 });
    const href = await fab.getAttribute("href");
    expect(href).toContain(`https://wa.me/${WHATSAPP_NUMBER}`);
  });

  test("aparece en /pricing (montado en el layout)", async ({ page }) => {
    await page.goto("/pricing");
    const fab = page.getByTestId("whatsapp-fab");
    await expect(fab).toBeVisible({ timeout: 10000 });
  });

  test("solo se renderiza una vez (sin duplicado en home)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("whatsapp-fab")).toHaveCount(1);
  });
});

test.describe("Pricing — CTA de contacto (sin planes ni precios)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
  });

  test("ya no existe el botón de prueba gratuita de 14 días", async ({ page }) => {
    await expect(page.getByText(/prueba gratis/i)).toHaveCount(0);
    await expect(page.getByText(/14 d[ií]as de prueba/i)).toHaveCount(0);
  });

  test("ya no se muestran precios de planes ($49 / $89 / mes)", async ({ page }) => {
    await expect(page.getByText(/\$49|\$89/)).toHaveCount(0);
    await expect(page.getByText(/\/mes/i)).toHaveCount(0);
  });

  test("el CTA único dice 'Contactar por WhatsApp' y abre WhatsApp", async ({
    page,
  }) => {
    const cta = page.getByTestId("pricing-cta");
    await expect(cta).toBeVisible({ timeout: 10000 });
    await expect(cta).toHaveText(/contactar por whatsapp/i);

    const href = await cta.getAttribute("href");
    expect(href).toContain(`https://wa.me/${WHATSAPP_NUMBER}`);

    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("rel", /noopener/);
  });
});
