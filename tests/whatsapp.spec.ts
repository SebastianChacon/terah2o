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

test.describe("Pricing — soporte WhatsApp", () => {
  test("el feature 'Soporte prioritario WhatsApp' enlaza a WhatsApp", async ({ page }) => {
    await page.goto("/pricing");
    const supportLink = page.getByRole("link", { name: /soporte prioritario whatsapp/i });
    await expect(supportLink).toBeVisible({ timeout: 10000 });
    const href = await supportLink.getAttribute("href");
    expect(href).toContain(`https://wa.me/${WHATSAPP_NUMBER}`);
  });
});

test.describe("Pricing — CTA de contacto (sin prueba gratuita)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
  });

  test("ya no existe el botón de prueba gratuita de 14 días", async ({ page }) => {
    await expect(page.getByText(/prueba gratis/i)).toHaveCount(0);
    await expect(page.getByText(/14 d[ií]as de prueba/i)).toHaveCount(0);
  });

  for (const plan of ["starter", "pro"] as const) {
    test(`el CTA del plan ${plan} dice 'Ponerse en contacto' y abre WhatsApp`, async ({
      page,
    }) => {
      const cta = page.getByTestId(`plan-cta-${plan}`);
      await expect(cta).toBeVisible({ timeout: 10000 });
      await expect(cta).toHaveText(/ponerse en contacto/i);

      const href = await cta.getAttribute("href");
      expect(href).toContain(`https://wa.me/${WHATSAPP_NUMBER}`);
      expect(href).toContain("?text=");

      await expect(cta).toHaveAttribute("target", "_blank");
      await expect(cta).toHaveAttribute("rel", /noopener/);
    });
  }
});
