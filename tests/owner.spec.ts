import { test, expect } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";
import { seedTestData, seedDisposableOperator } from "./helpers/seed-test-data";

// SUPER_ADMIN_EMAIL debe coincidir con el correo de este admin de prueba.
// Configurar en el deployment de Convex: `npx convex env set SUPER_ADMIN_EMAIL carlos.test.777@ptap.ec`
const OWNER_EMAIL = process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";
const OPERATOR_EMAIL = process.env.TEST_OPERATOR_EMAIL ?? "trelles@gmail.com";

async function waitConvex(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000); // Convex WebSocket + UserSync
}

// Navega a una vista del panel vía la barra lateral (primer match = sidebar visible).
async function goToView(
  page: import("@playwright/test").Page,
  label: string
) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(500);
}

test.describe.serial("Panel Owner Pro (super-admin global)", () => {
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
    // No debe filtrar el panel (ni el dashboard ni la navegación)
    await expect(page.locator("text=Resumen ejecutivo")).not.toBeVisible();
  });

  // ── 2. Autorizado: ve el dashboard con métricas ───────────────────────────
  test("owner ve el dashboard y sus métricas globales", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);

    // Vista por defecto = Resumen (dashboard)
    await expect(page.locator("text=Resumen ejecutivo")).toBeVisible({ timeout: 12000 });
    await expect(page.locator("text=MRR estimado")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("text=Organizaciones").first()).toBeVisible();

    // En Cuentas, su propia cuenta aparece
    await goToView(page, "Cuentas");
    await expect(page.locator(`text=${OWNER_EMAIL}`).first()).toBeVisible({ timeout: 8000 });
  });

  // ── 3. Toggle de permiso persiste tras recargar ───────────────────────────
  test("owner puede alternar un permiso de un operador y persiste", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);
    await goToView(page, "Cuentas");

    const row = page.locator("div.rounded-xl").filter({ hasText: OPERATOR_EMAIL }).first();
    await expect(row).toBeVisible({ timeout: 8000 });

    const toggle = row.getByRole("button", { name: /Asistencia/i }).first();
    await expect(toggle).toBeVisible();

    const wasOn = (await toggle.getAttribute("class"))?.includes("emerald") ?? false;
    await toggle.click();
    await page.waitForTimeout(1500); // mutación Convex

    // Recargar (vuelve al dashboard) → ir a Cuentas y comprobar el estado contrario
    await page.reload();
    await waitConvex(page);
    await goToView(page, "Cuentas");
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
    await goToView(page, "Cuentas");

    // La fila del propio owner (admin + dueño de org): botón eliminar deshabilitado
    const ownerRow = page.locator("div.rounded-xl").filter({ hasText: OWNER_EMAIL }).first();
    await expect(ownerRow).toBeVisible({ timeout: 8000 });
    await expect(ownerRow.getByText("Dueño")).toBeVisible();
    // El último botón de la fila = eliminar (debe estar deshabilitado para el dueño)
    await expect(ownerRow.getByRole("button").last()).toBeDisabled();
  });

  // ── 5. Editor de suscripción guarda (no destructivo) ──────────────────────
  test("owner puede cambiar y guardar la suscripción de una org", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);
    await goToView(page, "Suscripciones");

    const card = page.locator("div.rounded-xl").filter({ has: page.getByRole("button", { name: "Guardar" }) }).first();
    await expect(card).toBeVisible({ timeout: 8000 });

    // Guardar sin cambiar valores → toast de éxito (idempotente, no destructivo)
    await card.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator("text=/actualizada/i")).toBeVisible({ timeout: 8000 });
  });

  // ── 6. Eliminar una cuenta individual (el bug reportado) ──────────────────
  // Crea un operador desechable (solo en Convex, sin Clerk) y lo elimina vía la
  // UI. Verifica el camino feliz del flujo de borrado de cuenta: confirma el
  // diálogo → toast de éxito → la fila desaparece de la lista.
  test("owner elimina una cuenta de operador y desaparece de la lista", async ({ page, context }) => {
    const operatorEmail = await seedDisposableOperator(OWNER_EMAIL);

    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);
    await goToView(page, "Cuentas");

    // Buscar para aislar la fila del operador desechable
    await page.getByPlaceholder(/Buscar/i).fill(operatorEmail);
    await page.waitForTimeout(500);

    const row = page.locator("div.rounded-xl").filter({ hasText: operatorEmail }).first();
    await expect(row).toBeVisible({ timeout: 8000 });

    // Botón eliminar (por title; en filas de operador hay también toggles de
    // permisos, así que NO sirve .last()). Habilitado: no es dueño de org.
    const deleteBtn = row.getByTitle("Eliminar cuenta");
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    // Confirmar en el diálogo
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();

    // Toast de éxito y la cuenta deja de existir
    await expect(page.locator("text=/eliminada/i")).toBeVisible({ timeout: 12000 });
    await expect(
      page.locator("div.rounded-xl").filter({ hasText: operatorEmail })
    ).toHaveCount(0, { timeout: 8000 });
  });

  // ── 7. Crear cliente y eliminarlo (aislado, limpia tras sí) ────────────────
  test("owner crea un cliente nuevo y luego elimina la org", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);

    // Limpia cualquier org de prueba dejada por una corrida anterior.
    await goToView(page, "Organizaciones");
    await deleteTestOrgs(page);

    const stamp = Date.now();
    const orgName = `E2E Test Org ${stamp}`;
    const adminEmail = `e2e.client.${stamp}@ptap.ec`;

    // Abrir modal "Nuevo cliente" desde la barra lateral
    await page.getByRole("button", { name: "Nuevo cliente" }).first().click();
    await page.getByPlaceholder("PTAP Ejemplo").fill(orgName);
    await page.getByPlaceholder("Juan Pérez").fill(`Admin ${stamp}`);
    await page.getByPlaceholder("admin@ptap.ec").fill(adminEmail);
    await page.getByRole("button", { name: "Crear cliente" }).click();
    await expect(page.locator("text=/creado/i")).toBeVisible({ timeout: 12000 });

    // Aparece en Organizaciones
    await goToView(page, "Organizaciones");
    const orgCard = page.locator("div.rounded-xl").filter({ hasText: orgName }).first();
    await expect(orgCard).toBeVisible({ timeout: 8000 });

    // Eliminar la org de prueba (limpieza): abrir modal por título, tipear nombre, confirmar
    await orgCard
      .getByRole("button", { name: "Eliminar organización completa" })
      .click();
    await page.getByPlaceholder(orgName).fill(orgName);
    await page.getByRole("button", { name: "Eliminar org", exact: true }).click();
    await expect(page.locator("text=/eliminada/i")).toBeVisible({ timeout: 12000 });
  });

  // ── 8. Páginas habilitadas (entitlements) + cupo de admins ────────────────
  // Crea una org desechable (entitlements default = OFF), habilita una página y
  // cambia el cupo de admins; verifica persistencia; limpia al final.
  test("owner habilita una página y cambia el cupo de admins de una org", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);

    await goToView(page, "Organizaciones");
    await deleteTestOrgs(page);

    const stamp = Date.now();
    const orgName = `E2E Test Org Ent ${stamp}`;
    const adminEmail = `e2e.ent.${stamp}@ptap.ec`;

    // Crear cliente desechable
    await page.getByRole("button", { name: "Nuevo cliente" }).first().click();
    await page.getByPlaceholder("PTAP Ejemplo").fill(orgName);
    await page.getByPlaceholder("Juan Pérez").fill(`Admin ${stamp}`);
    await page.getByPlaceholder("admin@ptap.ec").fill(adminEmail);
    await page.getByRole("button", { name: "Crear cliente" }).click();
    await expect(page.locator("text=/creado/i")).toBeVisible({ timeout: 12000 });

    await goToView(page, "Organizaciones");
    const card = page.locator("div.rounded-xl").filter({ hasText: orgName }).first();
    await expect(card).toBeVisible({ timeout: 8000 });

    // Default OFF: habilitar "Operaciones (hub)"
    const opsToggle = card.getByRole("button", { name: "Operaciones (hub)", exact: true }).first();
    await expect(opsToggle).toBeVisible();
    expect((await opsToggle.getAttribute("class"))?.includes("emerald") ?? false).toBe(false);
    await opsToggle.click();
    await page.waitForTimeout(1500);

    // Cambiar cupo de administradores a 3
    const adminSeats = card
      .locator('label:has-text("Cupo de administradores") + div input[type="number"]')
      .first();
    await adminSeats.fill("3");
    await card
      .locator('label:has-text("Cupo de administradores") + div button')
      .first()
      .click();
    await expect(page.locator("text=/administradores actualizado/i")).toBeVisible({ timeout: 8000 });

    // Recargar y verificar persistencia
    await page.reload();
    await waitConvex(page);
    await goToView(page, "Organizaciones");
    const cardAfter = page.locator("div.rounded-xl").filter({ hasText: orgName }).first();
    const opsAfter = cardAfter.getByRole("button", { name: "Operaciones (hub)", exact: true }).first();
    expect((await opsAfter.getAttribute("class"))?.includes("emerald") ?? false).toBe(true);
    const adminSeatsAfter = cardAfter
      .locator('label:has-text("Cupo de administradores") + div input[type="number"]')
      .first();
    await expect(adminSeatsAfter).toHaveValue("3");

    // Limpieza: eliminar la org de prueba
    await cardAfter
      .getByRole("button", { name: "Eliminar organización completa" })
      .click();
    await page.getByPlaceholder(orgName).fill(orgName);
    await page.getByRole("button", { name: "Eliminar org", exact: true }).click();
    await expect(page.locator("text=/eliminada/i")).toBeVisible({ timeout: 12000 });
  });
});

// Borra todas las org-cards cuyo nombre empieza con "E2E Test Org".
async function deleteTestOrgs(page: import("@playwright/test").Page) {
  for (let i = 0; i < 30; i++) {
    const card = page
      .locator("div.rounded-xl")
      .filter({ hasText: /E2E Test Org/ })
      .first();
    if ((await card.count()) === 0) return;
    const name = (await card.locator("span.truncate").first().innerText()).trim();
    await card
      .getByRole("button", { name: "Eliminar organización completa" })
      .click();
    await page.getByPlaceholder(name).fill(name);
    await page.getByRole("button", { name: "Eliminar org", exact: true }).click();
    await expect(page.locator("text=/eliminada/i")).toBeVisible({ timeout: 12000 });
    await page.waitForTimeout(800);
  }
}
