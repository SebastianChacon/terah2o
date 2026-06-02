import { test, expect } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";

const ADMIN_EMAIL = process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";
const RUN_ID = Date.now();
const OPERATOR_EMAIL = `op.e2e.${RUN_ID}@ptap-test.ec`;
const OPERATOR_NAME = "Operador E2E Test";

test.describe.serial("Admin Dashboard — gestión de operadores", () => {
  test("admin puede acceder a /dashboard/admin", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, ADMIN_EMAIL);
    await page.goto("/dashboard/admin");
    await expect(page.locator("text=Panel de Administración")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("h2", { hasText: "Operadores" })).toBeVisible();
  });

  test("admin crea operador y ve toast de éxito", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, ADMIN_EMAIL);
    await page.goto("/dashboard/admin");
    await expect(page.locator("text=Panel de Administración")).toBeVisible({ timeout: 10000 });

    const addBtn = page.locator("button", { hasText: /agregar/i });
    if (!(await addBtn.isVisible())) {
      test.skip(true, "Límite de operadores alcanzado — no se puede crear en este run");
    }

    await addBtn.click();
    await expect(page.locator("text=Nuevo Operador")).toBeVisible();

    const form = page.locator("form");
    await form.locator("input[placeholder='Ing. Ana Torres']").fill(OPERATOR_NAME);
    await form.locator("input[type='email']").fill(OPERATOR_EMAIL);
    await page.locator("button", { hasText: /crear operador/i }).click();

    await expect(page.locator("text=/Operador creado/i")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=${OPERATOR_EMAIL}`).first()).toBeVisible({ timeout: 5000 });
  });

  test("admin puede cambiar permisos sin ArgumentValidationError", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, ADMIN_EMAIL);
    await page.goto("/dashboard/admin");
    await expect(page.locator("text=Panel de Administración")).toBeVisible({ timeout: 10000 });

    const operatorCard = page
      .locator("div.p-4")
      .filter({ has: page.locator(`text=${OPERATOR_EMAIL}`) });
    await expect(operatorCard).toBeVisible({ timeout: 8000 });

    const validationErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("ArgumentValidationError")) {
        validationErrors.push(msg.text());
      }
    });

    await operatorCard.locator("button", { hasText: /operaciones/i }).click();
    await page.waitForTimeout(2500);

    expect(validationErrors).toHaveLength(0);
  });

  test("admin puede invitar co-administrador", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, ADMIN_EMAIL);
    await page.goto("/dashboard/admin");
    await expect(page.locator("text=Panel de Administración")).toBeVisible({ timeout: 10000 });

    const inviteBtn = page.locator("button", { hasText: /invitar admin/i });
    if (!(await inviteBtn.isVisible())) {
      test.skip(true, "Límite de administradores alcanzado");
    }

    const adminEmail = `admin.e2e.${RUN_ID}@ptap-test.ec`;
    const adminName = "Co-Admin E2E Test";

    await inviteBtn.click();
    await expect(page.locator("text=Invitar co-administrador")).toBeVisible();

    const adminForm = page.locator("form").filter({ has: page.locator("text=Invitar co-administrador") });
    await adminForm.locator("input[placeholder='Ing. Juan Pérez']").fill(adminName);
    await adminForm.locator("input[type='email']").fill(adminEmail);
    await adminForm.locator("button", { hasText: /enviar invitación/i }).click();

    await expect(page.locator("text=/Administrador invitado/i")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=${adminEmail}`).first()).toBeVisible({ timeout: 5000 });
  });

  test("admin puede eliminar operador creado en E2E", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, ADMIN_EMAIL);
    await page.goto("/dashboard/admin");
    await expect(page.locator("text=Panel de Administración")).toBeVisible({ timeout: 10000 });

    const operatorCard = page.locator("div.p-4").filter({ has: page.locator(`text=${OPERATOR_EMAIL}`) });
    await expect(operatorCard).toBeVisible({ timeout: 8000 });

    await operatorCard.locator("button[title='Eliminar operador']").click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^eliminar$/i }).click();

    await expect(page.locator("text=/eliminado/i")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${OPERATOR_EMAIL}`)).not.toBeVisible({ timeout: 5000 });
  });
});
