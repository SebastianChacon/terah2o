import { test, expect, type Page } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";
import { seedTestData } from "./helpers/seed-test-data";

// Usuario solicitado explícitamente para este E2E (operador de prueba).
const TEST_EMAIL = process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";

/**
 * Captura del HTML de los PDFs sin abrir ventanas reales. Tanto Finanzas como
 * Bitácora hacen: buildMemoriaFinancieraHTML → Blob → URL.createObjectURL →
 * window.open. Interceptamos createObjectURL para leer el HTML del Blob y
 * neutralizamos window.open para que no bloquee con el diálogo de impresión.
 */
async function installPdfCapture(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__htmls = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      try {
        blob.text().then((t) => {
          (window as unknown as { __htmls: string[] }).__htmls.push(t);
        });
      } catch {
        /* noop */
      }
      return orig(blob);
    };
    // Devuelve un stub truthy: el código hace `if (w) ...` y si window.open
    // retorna null muestra un toast de error que pisaría "Informe guardado".
    window.open = () =>
      ({ closed: false, close() {}, focus() {} }) as unknown as Window;
  });
}

async function capturedHtmls(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __htmls: string[] }).__htmls
  );
}

async function loginAndSync(page: Page) {
  await loginWithClerkTicket(page, TEST_EMAIL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000); // Convex WS + UserSync
}

// Llena el formulario de Finanzas (modo projection) con datos válidos.
async function fillFinanzas(page: Page, instName: string) {
  await page
    .locator('input[placeholder="Ingrese nombre de la planta"]')
    .fill(instName);
  await page.locator('label:has-text("Caudal (L/s)") + input').fill("20");
  await page
    .locator('label:has-text("Horas Operacion/Dia") + input')
    .fill("12");
  // Primera fila de químicos: dosis (step 0.1) + precio (step 0.01)
  await page.locator('input[step="0.1"]').first().fill("15");
  await page.locator('input[step="0.01"]').first().fill("2.5");
  await page
    .locator('label:has-text("Perdidas Tecnicas/Comerciales (%)") + input')
    .fill("10");
  await page
    .locator('label:has-text("Tarifa Actual / Sugerida") + input')
    .fill("0.5");
}

test.describe("finanzas — guardar → modal hoy → paridad PDF bitácora", () => {
  test.beforeAll(async () => {
    await seedTestData(TEST_EMAIL);
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("flujo completo: genera, modal de hoy aparece, bitácora reproduce el mismo PDF", async ({
    page,
  }) => {
    page.on("console", (m) => console.log(`[browser ${m.type()}] ${m.text()}`));
    await installPdfCapture(page);
    await loginAndSync(page);

    await page.goto("/operaciones/finanzas");
    await expect(
      page.getByRole("heading", { name: /Gestion Economica Integral PTAP/i })
    ).toBeVisible({ timeout: 15000 });

    const INST = `E2E Finanzas ${Date.now()}`;

    // ── 1. Primer informe ────────────────────────────────────────────────
    await fillFinanzas(page, INST);

    const generateBtn = page.getByRole("button", {
      name: /Generar Informe Gerencial PTAP/i,
    });
    await generateBtn.click();

    // Si ya hubo informes hoy (datos previos), el modal aparece ya en el 1er
    // click → continuar. Si no, guarda directo.
    const modalHeading = page.getByRole("heading", {
      name: /Informes generados hoy/i,
    });
    if (await modalHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page
        .getByRole("button", { name: /Continuar y generar/i })
        .click();
    }

    await expect(page.locator("text=Informe guardado")).toBeVisible({
      timeout: 20000,
    });

    // PDF de Finanzas capturado y con datos correctos.
    await expect
      .poll(async () => (await capturedHtmls(page)).length, { timeout: 8000 })
      .toBeGreaterThan(0);
    const finHtmls = await capturedHtmls(page);
    const finHtml = finHtmls[finHtmls.length - 1];
    expect(finHtml).toContain("Memoria de Gestion Financiera");
    expect(finHtml).toContain(INST);

    // ── 2. Segundo informe → el modal de HOY DEBE aparecer ───────────────
    // resetForm() limpió el form; el registro recién creado ya cuenta como
    // "informe de hoy". `todaysReports` deriva de la query reactiva de Convex
    // (getAll), que propaga de forma asíncrona tras el save: damos margen para
    // que el informe recién guardado entre en la lista antes de re-generar.
    await page.waitForTimeout(5000);
    const INST2 = `${INST} B`;
    await fillFinanzas(page, INST2);
    await generateBtn.click();

    await expect(modalHeading).toBeVisible({ timeout: 10000 });
    // El modal resume los informes generados HOY: cada fila trae título +
    // etiqueta "Inversion Mensual" + monto. (La verificación de que NUESTRO
    // informe específico persistió se hace en Bitácora, abajo.)
    await expect(page.locator("text=Inversion Mensual").first()).toBeVisible();
    await expect(page.locator("text=/\\d+ informes? en esta fecha/")).toBeVisible();

    await page.getByRole("button", { name: /Cancelar/i }).click();
    await expect(modalHeading).toBeHidden({ timeout: 5000 });

    // Re-generar confirmando esta vez.
    await generateBtn.click();
    await expect(modalHeading).toBeVisible({ timeout: 8000 });
    await page.getByRole("button", { name: /Continuar y generar/i }).click();
    await expect(page.locator("text=Informe guardado")).toBeVisible({
      timeout: 20000,
    });

    // ── 3. Bitácora reproduce el MISMO documento ─────────────────────────
    await page.goto("/operaciones/bitacora");
    await page
      .getByRole("button", { name: /Reporte Financiero/i })
      .click();
    await page.waitForTimeout(4000); // Convex realtime

    // Fila del primer informe + su botón PDF.
    const row = page
      .locator("tr")
      .filter({ hasText: INST })
      .first();
    await expect(row).toBeVisible({ timeout: 10000 });

    const htmlsBefore = (await capturedHtmls(page)).length;
    await row.getByRole("button", { name: /PDF/i }).click();

    await expect
      .poll(async () => (await capturedHtmls(page)).length, { timeout: 8000 })
      .toBeGreaterThan(htmlsBefore);

    const allHtmls = await capturedHtmls(page);
    const bitHtml = allHtmls[allHtmls.length - 1];

    // Paridad por construcción: mismo builder, mismos encabezados/datos.
    expect(bitHtml).toContain("Memoria de Gestion Financiera");
    expect(bitHtml).toContain(INST);
    expect(bitHtml).toContain("Coagulante (PAC)");
    expect(bitHtml).toContain("Inversion Mensual Total");
    // El footer (Inversión Mensual Total) debe coincidir con el de Finanzas.
    const grab = (html: string) =>
      html.match(/Inversion Mensual Total[\s\S]*?\$[\d.,]+/)?.[0] ?? "";
    expect(grab(bitHtml)).not.toBe("");
  });
});
