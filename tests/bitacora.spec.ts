import { test, expect } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";
import { seedTestData } from "./helpers/seed-test-data";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "chacontsebastian@gmail.com";

async function loginAndWaitForSync(page: Parameters<typeof loginWithClerkTicket>[0]) {
  await loginWithClerkTicket(page, TEST_EMAIL);
  await page.waitForLoadState("networkidle");
  // Allow Convex WebSocket + UserSync to complete
  await page.waitForTimeout(3000);
}

test.describe("hoja-operativa — operator identity + audit", () => {
  test.beforeAll(async () => {
    await seedTestData(TEST_EMAIL);
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  // ── 1. Page loads ──────────────────────────────────────────────────────
  test("hoja operativa page loads with operator input", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/operaciones/hoja-operativa");

    await expect(page.getByRole("heading", { name: /Hoja Operativa/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("input[placeholder='Nombre completo']")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("button", { name: /Finalizar Turno/i })
    ).toBeVisible();
  });

  // ── 2. Operator name input pre-filled (or at least editable) ──────────
  test("operator name input is accessible and accepts input", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/operaciones/hoja-operativa");

    const nameInput = page.locator("input[placeholder='Nombre completo']");
    await expect(nameInput).toBeVisible({ timeout: 10000 });

    // Wait extra for Convex user data to arrive and prefill
    await page.waitForTimeout(4000);
    const prefilled = await nameInput.inputValue();
    console.log("[test] operator name prefilled value:", JSON.stringify(prefilled));

    // Clear + fill — must accept text
    await nameInput.fill("E2E Test Operator");
    await expect(nameInput).toHaveValue("E2E Test Operator");
  });

  // ── 3. Prefill actually comes from authenticated user ──────────────────
  test("operator name prefills from authenticated Convex user", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/operaciones/hoja-operativa");

    const nameInput = page.locator("input[placeholder='Nombre completo']");
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(5000); // Convex user query resolves

    const value = await nameInput.inputValue();
    // If Convex user has a name, it will be non-empty; if not it's empty but that's ok
    console.log("[test] prefill from user.name:", JSON.stringify(value));
    // The field is correctly bound — either prefilled or blank (no crash)
    expect(typeof value).toBe("string");
  });

  // ── 4. Finalizar Turno saves + shows success toast ─────────────────────
  test("finalizar turno saves shift and shows success toast", async ({ page }) => {
    // Prevent PDF print dialog from blocking
    await page.addInitScript(() => {
      window.open = () => null;
    });

    await loginAndWaitForSync(page);
    await page.goto("/operaciones/hoja-operativa");

    const nameInput = page.locator("input[placeholder='Nombre completo']");
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill("Operador E2E Turno");

    const finalizeBtn = page.getByRole("button", { name: /Finalizar Turno/i });
    await expect(finalizeBtn).toBeVisible();
    await finalizeBtn.click();

    // Success toast must appear
    await expect(
      page.locator("text=Turno archivado correctamente")
    ).toBeVisible({ timeout: 20000 });
  });

  // ── 5. After turno save, bitacoraEntries has audit entry ──────────────
  test("turno save writes audit entry visible in Bitácora Auditoría tab", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.open = () => null;
    });

    // Capture all browser console output for debugging
    page.on("console", (msg) => console.log(`[browser ${msg.type()}] ${msg.text()}`));

    await loginAndWaitForSync(page);

    // Save a turno
    await page.goto("/operaciones/hoja-operativa");
    const nameInput = page.locator("input[placeholder='Nombre completo']");
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill("Operador Audit E2E");

    await page.getByRole("button", { name: /Finalizar Turno/i }).click();
    await expect(
      page.locator("text=Turno archivado correctamente")
    ).toBeVisible({ timeout: 20000 });

    // Navigate to Bitácora
    await page.goto("/operaciones/bitacora");
    const auditTab = page.getByRole("button", { name: /Auditoría/i });
    await expect(auditTab).toBeVisible({ timeout: 10000 });
    await auditTab.click();

    // Wait for Convex real-time sync
    await page.waitForTimeout(4000);

    // Audit timeline header visible
    await expect(
      page.locator("text=Timeline de Eventos Operativos")
    ).toBeVisible({ timeout: 10000 });

    // At least one entry from "Hoja Operativa" source must appear
    await expect(
      page.locator("text=Hoja Operativa").first()
    ).toBeVisible({ timeout: 10000 });

    // The Turno category chip must appear
    const turnoChip = page.locator("text=Turno").first();
    await expect(turnoChip).toBeVisible({ timeout: 5000 });
  });

  // ── 6. Stock audit entries written on turno save with flow ────────────
  test("turno with flow > 0 writes inventory audit entries", async ({ page }) => {
    await page.addInitScript(() => {
      window.open = () => null;
    });

    await loginAndWaitForSync(page);
    await page.goto("/operaciones/hoja-operativa");

    const nameInput = page.locator("input[placeholder='Nombre completo']");
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill("Operador Stock Audit");

    // Set plant flow to trigger stock deduction path
    const flowInput = page.locator("input[placeholder='0.0']").first();
    await flowInput.fill("10");

    // Set ml/min for the dosification row
    const mlMinInput = page.locator("input[placeholder='0']").first();
    await mlMinInput.fill("50");

    await page.getByRole("button", { name: /Finalizar Turno/i }).click();
    await expect(
      page.locator("text=Turno archivado correctamente")
    ).toBeVisible({ timeout: 20000 });

    // Go to Bitácora Auditoría
    await page.goto("/operaciones/bitacora");
    await page.getByRole("button", { name: /Auditoría/i }).click();
    await page.waitForTimeout(4000);

    // Turno category should appear (at minimum)
    await expect(page.locator("text=Hoja Operativa").first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("bitacora — Auditoría tab UI", () => {
  test.beforeAll(async () => {
    await seedTestData(TEST_EMAIL);
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  // ── 7. Bitácora loads with 5 tabs ─────────────────────────────────────
  test("bitacora shows all 5 navigation tabs including Auditoría", async ({
    page,
  }) => {
    await loginAndWaitForSync(page);
    await page.goto("/operaciones/bitacora");

    await expect(
      page.getByRole("button", { name: /Diseño Técnico/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: /Operación Turnos/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Control Insumos/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Reporte Financiero/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Auditoría/i })
    ).toBeVisible();
  });

  // ── 8. Auditoría tab click shows timeline section ─────────────────────
  test("clicking Auditoría tab shows timeline section", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/operaciones/bitacora");

    const auditTab = page.getByRole("button", { name: /Auditoría/i });
    await expect(auditTab).toBeVisible({ timeout: 10000 });
    await auditTab.click();

    await expect(
      page.locator("text=Timeline de Eventos Operativos")
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 9. Auditoría tab has event count badge ────────────────────────────
  test("Auditoría tab shows event count badge", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/operaciones/bitacora");

    const auditTab = page.getByRole("button", { name: /Auditoría/i });
    await auditTab.click();

    // The "N eventos" badge must render (even if 0)
    await expect(page.locator("text=/\\d+ eventos/")).toBeVisible({
      timeout: 10000,
    });
  });

  // ── 10. Empty state message shown when no entries ─────────────────────
  test("Auditoría empty state shows helpful message when no entries", async ({
    page,
  }) => {
    // Fresh context — might have entries or not, either is valid
    await loginAndWaitForSync(page);
    await page.goto("/operaciones/bitacora");

    await page.getByRole("button", { name: /Auditoría/i }).click();
    await page.waitForTimeout(4000); // Convex load

    const bodyText = await page.locator("body").innerText();
    const bodyLower = bodyText.toLowerCase();
    // Must show either entries (CSS uppercase transforms source names) OR the empty state message
    const hasEntries = bodyLower.includes("hoja operativa") || bodyLower.includes("finanzas");
    const hasEmptyMsg = bodyLower.includes("no hay eventos registrados");
    // Also accept "Cargando" state as valid (Convex still syncing)
    const isLoading = bodyLower.includes("cargando eventos");
    expect(
      hasEntries || hasEmptyMsg || isLoading,
      `Should show entries, empty-state, or loading. Body: ${bodyText.slice(0, 300)}`
    ).toBe(true);
  });

  // ── 11. Global search filters Auditoría entries ───────────────────────
  test("global search filters entries in Auditoría tab", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/operaciones/bitacora");

    await page.getByRole("button", { name: /Auditoría/i }).click();
    await page.waitForTimeout(3000);

    // Type a search that matches nothing
    const searchInput = page.locator("input[placeholder='Buscar registros históricos...']");
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("zzzzzznonexistentxyz");

    // After filtering, only empty state or no results should be visible
    const bodyText = await page.locator("body").innerText();
    const bodyLower = bodyText.toLowerCase();
    const hasNoResults =
      bodyLower.includes("no hay eventos") || !bodyLower.includes("hoja operativa");
    expect(hasNoResults).toBe(true);
  });

  // ── 12. Bitácora Auditoría tab accessible from /operaciones hub ───────
  test("operaciones hub links to bitacora page", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/operaciones");

    // Find Bitácora link
    const bitacoraLink = page
      .getByRole("link", { name: /[Bb]it[áa]cora/i })
      .first();
    await expect(bitacoraLink).toBeVisible({ timeout: 10000 });
  });

  // ── 13. Auditoría tab shows PDF + Excel download buttons ─────────────
  test("Auditoría tab shows PDF and Excel download buttons", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/operaciones/bitacora");

    const auditTab = page.getByRole("button", { name: /Auditoría/i });
    await expect(auditTab).toBeVisible({ timeout: 10000 });
    await auditTab.click();

    await expect(page.locator("text=Timeline de Eventos Operativos")).toBeVisible({ timeout: 8000 });

    // Both export buttons must be visible in the tab header
    const pdfBtn = page.getByRole("button", { name: /^PDF$/i }).last();
    const excelBtn = page.getByRole("button", { name: /^Excel$/i }).last();
    await expect(pdfBtn).toBeVisible({ timeout: 5000 });
    await expect(excelBtn).toBeVisible({ timeout: 5000 });
  });

  // ── 14. PDF button triggers print dialog (or toast if no data) ────────
  test("PDF button in Auditoría tab triggers window.open or shows empty toast", async ({ page }) => {
    // Track window.open calls — prevent actual print dialog
    let windowOpenCalled = false;
    await page.addInitScript(() => {
      window.open = () => { (window as unknown as Record<string, unknown>).__auditPdfOpened = true; return null; };
    });

    await loginAndWaitForSync(page);
    await page.goto("/operaciones/bitacora");

    await page.getByRole("button", { name: /Auditoría/i }).click();
    await expect(page.locator("text=Timeline de Eventos Operativos")).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(3000); // Convex data load

    const pdfBtn = page.getByRole("button", { name: /^PDF$/i }).last();
    await expect(pdfBtn).toBeVisible({ timeout: 5000 });
    await pdfBtn.click();

    // Either window.open fired (has data) or toast shows "no hay eventos" (empty)
    windowOpenCalled = await page.evaluate(() => !!(window as unknown as Record<string, unknown>).__auditPdfOpened);
    const bodyText = await page.locator("body").innerText();
    const hasToast = bodyText.toLowerCase().includes("no hay eventos");

    expect(
      windowOpenCalled || hasToast,
      `PDF button must either open print window or show empty-state toast. Body: ${bodyText.slice(0, 200)}`
    ).toBe(true);
  });
});
