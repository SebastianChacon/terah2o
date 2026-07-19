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

// Busca en la pestaña "Clientes" y abre el detalle del primer resultado.
async function openClientBySearch(
  page: import("@playwright/test").Page,
  query: string
) {
  await goToView(page, "Clientes");
  await page.getByPlaceholder(/Buscar/i).fill(query);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Gestionar" }).first().click();
  await page.waitForTimeout(500);
}

// Fila de un miembro del equipo dentro de ClientDetail — clase única no compartida
// por el card wrapper que la contiene (evita matchear el Section entero).
function teamRow(page: import("@playwright/test").Page) {
  return page.locator('div[class*="border-[#eef2f6]"][class*="rounded-xl"]');
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

  // ── 2. Autorizado: ve el dashboard con métricas y su org en Clientes ──────
  test("owner ve el dashboard y su organización en Clientes", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);

    // Vista por defecto = Resumen (dashboard)
    await expect(page.locator("text=Resumen ejecutivo")).toBeVisible({ timeout: 12000 });
    await expect(page.locator("text=MRR estimado")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("text=Organizaciones").first()).toBeVisible();

    // En Clientes, buscar por su propio correo aísla su organización
    await goToView(page, "Clientes");
    await page.getByPlaceholder(/Buscar/i).fill(OWNER_EMAIL);
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "Gestionar" })).toHaveCount(1, { timeout: 8000 });

    // Entrar al detalle muestra el equipo de la cuenta
    await page.getByRole("button", { name: "Gestionar" }).first().click();
    await expect(page.locator("text=Equipo de la cuenta")).toBeVisible({ timeout: 8000 });
  });

  // ── 3. Toggle de permiso de un operador persiste tras recargar ────────────
  test("owner puede alternar un permiso de un operador y persiste", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);
    await openClientBySearch(page, OWNER_EMAIL);

    // La fila del operador es la única con badge "Operador" + botón "Eliminar cuenta"
    // (independiente del nombre/correo mostrado, que puede variar).
    const row = teamRow(page)
      .filter({ has: page.getByTitle("Eliminar cuenta") })
      .filter({ hasText: "Operador" })
      .first();
    await expect(row).toBeVisible({ timeout: 8000 });

    const toggle = row.getByRole("button", { name: /Calidad de Agua/i }).first();
    await expect(toggle).toBeVisible();

    const wasOn = (await toggle.getAttribute("class"))?.includes("emerald") ?? false;
    await toggle.click();
    await page.waitForTimeout(1500); // mutación Convex

    // Recargar (vuelve al dashboard) → reabrir el cliente y comprobar el estado contrario
    await page.reload();
    await waitConvex(page);
    await openClientBySearch(page, OWNER_EMAIL);
    const rowAfter = teamRow(page)
      .filter({ has: page.getByTitle("Eliminar cuenta") })
      .filter({ hasText: "Operador" })
      .first();
    const toggleAfter = rowAfter.getByRole("button", { name: /Calidad de Agua/i }).first();
    const isOnAfter = (await toggleAfter.getAttribute("class"))?.includes("emerald") ?? false;
    expect(isOnAfter).toBe(!wasOn);

    // Restaurar estado original para no afectar otros specs
    await toggleAfter.click();
    await page.waitForTimeout(1500);
  });

  // ── 4. Guarda de eliminación: el dueño de la org no tiene botón de borrar ──
  test("la fila del dueño de la organización no tiene botón de eliminar", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);
    await openClientBySearch(page, OWNER_EMAIL);

    // La fila con el badge "Dueño" no debe exponer "Eliminar cuenta" ni "Promover/Degradar"
    const ownerRow = teamRow(page).filter({ hasText: "Dueño" }).first();
    await expect(ownerRow).toBeVisible({ timeout: 8000 });
    await expect(ownerRow.getByTitle("Eliminar cuenta")).toHaveCount(0);

    // Otro miembro (no dueño) sí expone el botón, habilitado
    const otherRow = teamRow(page)
      .filter({ has: page.getByTitle("Eliminar cuenta") })
      .first();
    await expect(otherRow).toBeVisible();
    await expect(otherRow.getByTitle("Eliminar cuenta")).toBeEnabled();
  });

  // ── 5. Editor de suscripción guarda (no destructivo) ──────────────────────
  test("owner puede guardar la suscripción de una org", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);
    await openClientBySearch(page, OWNER_EMAIL);

    // Guardar sin cambiar valores → toast de éxito (idempotente, no destructivo)
    await page.getByRole("button", { name: "Guardar suscripción" }).click();
    await expect(page.locator("text=/actualizada/i")).toBeVisible({ timeout: 8000 });
  });

  // ── 6. Eliminar una cuenta de operador desechable ──────────────────────────
  // Crea un operador desechable (solo en Convex, sin Clerk) y lo elimina vía la
  // UI. Verifica el camino feliz del flujo de borrado de cuenta: confirma el
  // diálogo → toast de éxito → la fila desaparece de la lista.
  test("owner elimina una cuenta de operador y desaparece de la lista", async ({ page, context }) => {
    await seedDisposableOperator(OWNER_EMAIL);

    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);
    await openClientBySearch(page, OWNER_EMAIL);

    const row = teamRow(page).filter({ hasText: "E2E Disposable" }).first();
    await expect(row).toBeVisible({ timeout: 8000 });

    const deleteBtn = row.getByTitle("Eliminar cuenta");
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    // Confirmar en el diálogo
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();

    // Toast de éxito y la cuenta deja de existir
    await expect(page.locator("text=/eliminada/i")).toBeVisible({ timeout: 12000 });
    await expect(teamRow(page).filter({ hasText: "E2E Disposable" })).toHaveCount(0, {
      timeout: 8000,
    });
  });

  // ── 7. Crear cliente y eliminarlo (aislado, limpia tras sí) ────────────────
  test("owner crea un cliente nuevo y luego elimina la org", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OWNER_EMAIL);
    await page.goto("/owner");
    await waitConvex(page);

    // Limpia cualquier org de prueba dejada por una corrida anterior.
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

    // Aparece en Clientes
    await goToView(page, "Clientes");
    await page.getByPlaceholder(/Buscar/i).fill(orgName);
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "Gestionar" })).toHaveCount(1, { timeout: 8000 });

    // Eliminar la org de prueba (limpieza): entrar al detalle, tipear nombre, confirmar
    await page.getByRole("button", { name: "Gestionar" }).first().click();
    await page.getByRole("button", { name: "Eliminar organización" }).click();
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

    await goToView(page, "Clientes");
    await page.getByPlaceholder(/Buscar/i).fill(orgName);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Gestionar" }).first().click();
    await expect(page.locator("text=Permisos de acceso")).toBeVisible({ timeout: 8000 });

    // Default OFF: habilitar "Operaciones (hub)" (org-level, primer match = PermissionsCard)
    const opsToggle = page.getByRole("button", { name: "Operaciones (hub)", exact: true }).first();
    await expect(opsToggle).toBeVisible();
    expect((await opsToggle.getAttribute("class"))?.includes("e8f1fc") ?? false).toBe(false);
    await opsToggle.click();
    await page.waitForTimeout(1500);

    // Cambiar cupo de administradores a 3
    const adminSeats = page
      .locator('label:has-text("Cupo de administradores") + div input[type="number"]')
      .first();
    await adminSeats.fill("3");
    await page
      .locator('label:has-text("Cupo de administradores") + div button')
      .first()
      .click();
    await expect(page.locator("text=/administradores actualizado/i").first()).toBeVisible({ timeout: 8000 });

    // Recargar y verificar persistencia
    await page.reload();
    await waitConvex(page);
    await goToView(page, "Clientes");
    await page.getByPlaceholder(/Buscar/i).fill(orgName);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Gestionar" }).first().click();
    await expect(page.locator("text=Permisos de acceso")).toBeVisible({ timeout: 8000 });

    const opsAfter = page.getByRole("button", { name: "Operaciones (hub)", exact: true }).first();
    expect((await opsAfter.getAttribute("class"))?.includes("e8f1fc") ?? false).toBe(true);
    const adminSeatsAfter = page
      .locator('label:has-text("Cupo de administradores") + div input[type="number"]')
      .first();
    await expect(adminSeatsAfter).toHaveValue("3");

    // Limpieza: eliminar la org de prueba
    await page.getByRole("button", { name: "Eliminar organización" }).click();
    await page.getByPlaceholder(orgName).fill(orgName);
    await page.getByRole("button", { name: "Eliminar org", exact: true }).click();
    await expect(page.locator("text=/eliminada/i")).toBeVisible({ timeout: 12000 });
  });
});

// Busca en Clientes y borra todas las orgs cuyo nombre empieza con "E2E Test Org".
async function deleteTestOrgs(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Clientes", exact: true }).first().click();
  await page.waitForTimeout(500);
  const search = page.getByPlaceholder(/Buscar/i);

  for (let i = 0; i < 30; i++) {
    await search.fill("E2E Test Org");
    await page.waitForTimeout(500);
    const manageBtn = page.getByRole("button", { name: "Gestionar" }).first();
    if ((await manageBtn.count()) === 0) return;
    await manageBtn.click();

    const nameHeading = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .filter({ hasText: /E2E Test Org/ })
      .first();
    const name = (await nameHeading.innerText()).trim();

    await page.getByRole("button", { name: "Eliminar organización" }).click();
    await page.getByPlaceholder(name).fill(name);
    await page.getByRole("button", { name: "Eliminar org", exact: true }).click();
    await expect(page.locator("text=/eliminada/i")).toBeVisible({ timeout: 12000 });
    await page.waitForTimeout(800);
  }
}
