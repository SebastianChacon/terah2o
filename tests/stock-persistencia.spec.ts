import { test, expect, type Page } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";
import { seedTestData } from "./helpers/seed-test-data";

const TEST_EMAIL =
  process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";

async function loginAndWaitForSync(page: Page) {
  await loginWithClerkTicket(page, TEST_EMAIL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
}

async function ensurePacInventory(page: Page) {
  await page.goto("/operaciones/stock");
  await page.waitForTimeout(2000);
  const pacCard = page.locator("div").filter({ hasText: /^PAC$/ }).first();
  const cardText = await page.locator("main").innerText();
  if (cardText.includes("PAC") && !cardText.match(/PAC[\s\S]*?0\s*kg/)) {
    return;
  }
  const amountInput = page.locator("input[type='number']").first();
  if (await amountInput.isVisible().catch(() => false)) {
    await amountInput.fill("500");
    const saveBtn = page.getByRole("button", { name: /Registrar Carga/i });
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await expect(
        page.locator("text=/Carga de inventario registrada/i"),
      ).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2000);
    }
  }
  void pacCard;
}

async function finalizeShiftWithDosage(page: Page) {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await page.goto("/operaciones/hoja-operativa");
  const nameInput = page.locator("input[placeholder='Nombre completo']");
  await expect(nameInput).toBeVisible({ timeout: 10000 });
  await nameInput.fill("Operador Persistencia E2E");

  await page.locator("input[placeholder='0.0']").first().fill("10");
  await page.locator("input[placeholder='0']").first().fill("50");

  await page.getByRole("button", { name: /Finalizar Turno/i }).click();
  await expect(
    page.locator("text=Turno archivado correctamente"),
  ).toBeVisible({ timeout: 20000 });
}

async function openControlInsumos(page: Page) {
  await page.goto("/operaciones/bitacora");
  await page.getByRole("button", { name: /Control Insumos/i }).click();
  await page.waitForTimeout(4000);
}

function pacInventoryRow(page: Page) {
  return page.locator("tbody tr").filter({ hasText: /PAC/i });
}

test.describe("persistencia dailyConsumption — operaciones", () => {
  test.beforeAll(async () => {
    await seedTestData(TEST_EMAIL);
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("hoja operativa persiste dailyConsumption tras cerrar turno", async ({
    page,
  }) => {
    await loginAndWaitForSync(page);
    await ensurePacInventory(page);
    await finalizeShiftWithDosage(page);
    await openControlInsumos(page);

    const pacRow = pacInventoryRow(page);
    await expect(pacRow).toBeVisible({ timeout: 10000 });
    const rowText = await pacRow.innerText();
    expect(rowText).not.toMatch(/0\s*kg\/día/);
    expect(rowText).not.toContain("N/A");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Control Insumos/i }).click();
    await page.waitForTimeout(4000);

    const pacRowAfterReload = pacInventoryRow(page);
    const reloadedText = await pacRowAfterReload.innerText();
    expect(reloadedText).not.toMatch(/0\s*kg\/día/);
    expect(reloadedText).not.toContain("N/A");
  });

  test("stock enlazar turno persiste dailyConsumption", async ({ page }) => {
    await loginAndWaitForSync(page);
    await ensurePacInventory(page);
    await finalizeShiftWithDosage(page);

    await page.goto("/operaciones/stock");
    await page.waitForTimeout(5000);
    await page.getByRole("button", { name: /Enlazar Turno/i }).click();
    await expect(
      page.locator("text=Sincronización con Hoja Operativa exitosa"),
    ).toBeVisible({ timeout: 20000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    const mainText = await page.locator("main").innerText();
    expect(mainText).toMatch(/Consumo:\s*[1-9]\d*(\.\d+)?\s*kg\/día/);

    await openControlInsumos(page);
    const pacRow = pacInventoryRow(page);
    const rowText = await pacRow.innerText();
    expect(rowText).not.toMatch(/0\s*kg\/día/);
  });

  test("bitácora control insumos formatea fecha sin ISO crudo", async ({
    page,
  }) => {
    await loginAndWaitForSync(page);
    await openControlInsumos(page);

    const fechaCells = await page
      .locator("tbody tr td:first-child")
      .allTextContents();
    expect(fechaCells.length).toBeGreaterThan(0);
    for (const fecha of fechaCells) {
      if (fecha === "—") continue;
      expect(fecha).not.toMatch(/T\d{2}:/);
      expect(fecha).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    }
  });

  test("flujo end-to-end turno stock bitácora", async ({ page }) => {
    await loginAndWaitForSync(page);
    await ensurePacInventory(page);
    await finalizeShiftWithDosage(page);

    await page.goto("/operaciones/stock");
    await page.waitForTimeout(2000);
    const stockBefore = await page.locator("main").innerText();

    await page.getByRole("button", { name: /Enlazar Turno/i }).click();
    await expect(
      page.locator("text=Sincronización con Hoja Operativa exitosa"),
    ).toBeVisible({ timeout: 15000 });

    await openControlInsumos(page);
    const pacRow = pacInventoryRow(page);
    await expect(pacRow).toBeVisible({ timeout: 10000 });
    const insumosText = await pacRow.innerText();
    expect(insumosText).not.toMatch(/0\s*kg\/día/);
    expect(insumosText).not.toContain("N/A");

    await page.getByRole("button", { name: /Auditoría/i }).click();
    await page.waitForTimeout(4000);
    await expect(page.locator("text=Hoja Operativa").first()).toBeVisible({
      timeout: 10000,
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await openControlInsumos(page);
    const afterReload = await pacInventoryRow(page).innerText();
    expect(afterReload).not.toMatch(/0\s*kg\/día/);

    void stockBefore;
  });
});
