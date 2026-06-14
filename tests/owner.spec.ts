import { test, expect } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";
import { seedTestData } from "./helpers/seed-test-data";

// SUPER_ADMIN_EMAIL debe coincidir con el correo de este admin de prueba.
// Configurar en el deployment de Convex: `npx convex env set SUPER_ADMIN_EMAIL carlos.test.777@ptap.ec`
const OWNER_EMAIL = process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";
const OPERATOR_EMAIL = process.env.TEST_OPERATOR_EMAIL ?? "trelles@gmail.com";

async function waitConvex(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000); // Convex WebSocket + UserSync
}

test.describe.serial("Panel Owner (super-admin global)", () => {
  test.beforeAll(async () => {
    await seedTestData(OWNER_EMAIL);
  });

  // ── 1. No autorizado ───────────────────────────────────────────────────────
  test("operador NO-owner ve 'Acceso denegado' en /owner", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OPERATOR_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);

    await expect(page.locator("text=Acceso denegado")).toBeVisible({ timeout: 10000 });
    // No debe filtrar el panel ni la lista
    await expect(page.locator("text=Control global de cuentas")).not.toBeVisible();
  });

  // ── 2. Autorizado: ve el panel global ─────────────────────────────────────
  test("owner ve el panel con cuentas de varias orgs", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);

    await expect(page.locator("text=Control global de cuentas")).toBeVisible({ timeout: 12000 });
    // Su propia cuenta aparece en la lista
    await expect(page.locator(`text=${OWNER_EMAIL}`).first()).toBeVisible({ timeout: 8000 });
  });

  // ── 3. Toggle de permiso persiste tras recargar ───────────────────────────
  test("owner puede alternar un permiso de un operador y persiste", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);
    await expect(page.locator("text=Control global de cuentas")).toBeVisible({ timeout: 12000 });

    const row = page.locator("div.rounded-xl").filter({ hasText: OPERATOR_EMAIL }).first();
    await expect(row).toBeVisible({ timeout: 8000 });

    const toggle = row.getByRole("button", { name: /Asistencia/i }).first();
    await expect(toggle).toBeVisible();

    const wasOn = (await toggle.getAttribute("class"))?.includes("emerald") ?? false;
    await toggle.click();
    await page.waitForTimeout(1500); // mutación Convex

    // Recargar y comprobar el estado contrario al inicial
    await page.reload();
    await waitConvex(page);
    const rowAfter = page.locator("div.rounded-xl").filter({ hasText: OPERATOR_EMAIL }).first();
    const toggleAfter = rowAfter.getByRole("button", { name: /Asistencia/i }).first();
    const isOnAfter = (await toggleAfter.getAttribute("class"))?.includes("emerald") ?? false;
    expect(isOnAfter).toBe(!wasOn);

    // Restaurar estado original para no afectar otros specs
    await toggleAfter.click();
    await page.waitForTimeout(1500);
  });

  // ── 4. Guardas de eliminación ─────────────────────────────────────────────
  test("el botón eliminar del owner/dueño-de-org está deshabilitado", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);
    await expect(page.locator("text=Control global de cuentas")).toBeVisible({ timeout: 12000 });

    // La fila del propio owner (admin + dueño de org): único botón = eliminar, deshabilitado
    const ownerRow = page.locator("div.rounded-xl").filter({ hasText: OWNER_EMAIL }).first();
    await expect(ownerRow).toBeVisible({ timeout: 8000 });
    await expect(ownerRow.getByText("Dueño")).toBeVisible();
    await expect(ownerRow.getByRole("button").last()).toBeDisabled();
  });
});
