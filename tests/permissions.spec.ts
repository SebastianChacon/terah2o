import { test, expect } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";
import { seedTestData } from "./helpers/seed-test-data";

const ADMIN_EMAIL = process.env.TEST_EMAIL ?? "carlos.test.777@ptap.ec";
const OPERATOR_EMAIL = process.env.TEST_OPERATOR_EMAIL ?? "trelles@gmail.com";

// La org de prueba debe tener todas las páginas habilitadas (entitlements
// default = OFF) para que el admin pueda otorgar permisos a sus operadores.
test.beforeAll(async () => {
  await seedTestData(ADMIN_EMAIL);
});

// ── Helper: check if page shows the lock overlay ─────────────────────────────
async function expectLocked(page: import("@playwright/test").Page, moduleName: string) {
  await expect(
    page.locator("text=Acceso Restringido").first()
  ).toBeVisible({ timeout: 8000 });
  await expect(
    page.locator(`text=${moduleName}`).first()
  ).toBeVisible();
}

async function expectUnlocked(page: import("@playwright/test").Page, url: string) {
  await expect(
    page.locator("text=Acceso Restringido")
  ).not.toBeVisible({ timeout: 8000 });
  // Confirm we're on the right page (not redirected to login)
  await expect(page).toHaveURL(new RegExp(url));
}

// ── Admin: toggle off all permissions for trelles ────────────────────────────
test.describe.serial("Permissions — admin + operator flow", () => {
  test("admin can revoke all permissions for trelles@gmail.com", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, ADMIN_EMAIL);
    await page.goto("/dashboard/admin");
    await expect(page.locator("text=Panel de Administración")).toBeVisible({ timeout: 12000 });

    // Find operator card for trelles
    const card = page.locator("[data-testid='operator-card']").filter({ hasText: OPERATOR_EMAIL });
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Try without data-testid — look for a container with the email text
      const emailEl = page.locator(`text=${OPERATOR_EMAIL}`).first();
      await expect(emailEl).toBeVisible({ timeout: 8000 });
    }

    // Turn OFF all main module toggles if currently on
    const toggleLabels = ["Operaciones (hub)", "Asistencia", "Academia", "Bitácora"];
    for (const label of toggleLabels) {
      const toggle = page.locator("button", { hasText: label }).first();
      if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isOn = await toggle.getAttribute("aria-pressed");
        if (isOn === "true") await toggle.click();
      }
    }

    // Save
    const saveBtn = page.locator("button", { hasText: /guardar/i }).first();
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await expect(page.locator("text=/Permisos/i").first()).toBeVisible({ timeout: 8000 });
    }
  });

  // ── Operator sees lock overlays with all perms off ────────────────────────
  test("operator sees lock on /operaciones with canAccessOperaciones=false", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OPERATOR_EMAIL);
    await page.goto("/operaciones");
    await expectLocked(page, "Hub de Operaciones");
  });

  test("operator sees lock on /asistencia with canAccessAsistencia=false", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OPERATOR_EMAIL);
    await page.goto("/asistencia");
    await expectLocked(page, "Asistencia Técnica");
  });

  test("operator sees lock on /academia with canAccessAcademia=false", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OPERATOR_EMAIL);
    await page.goto("/academia");
    await expectLocked(page, "Academia");
  });

  test("operator sees lock on /operaciones/bitacora with canAccessBitacora=false", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OPERATOR_EMAIL);
    await page.goto("/operaciones/bitacora");
    await expectLocked(page, "Bitácora Maestra");
  });

  test("operator sees lock on /operaciones/consola-tecnica with canAccessConsolaTecnica=false", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OPERATOR_EMAIL);
    await page.goto("/operaciones/consola-tecnica");
    await expectLocked(page, "Consola Técnica");
  });

  // ── Admin grants Operaciones + all sub-modules ────────────────────────────
  test("admin grants canAccessOperaciones + all sub-modules to trelles", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, ADMIN_EMAIL);
    await page.goto("/dashboard/admin");
    await expect(page.locator("text=Panel de Administración")).toBeVisible({ timeout: 12000 });

    const allLabels = [
      "Operaciones (hub)",
      "Consola Técnica",
      "Hoja Operativa",
      "Stock & Kardex",
      "Finanzas",
      "Bitácora",
    ];
    for (const label of allLabels) {
      const toggle = page.locator("button", { hasText: label }).first();
      if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isOff = await toggle.getAttribute("aria-pressed");
        if (isOff === "false") await toggle.click();
      }
    }

    const saveBtn = page.locator("button", { hasText: /guardar/i }).first();
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await expect(page.locator("text=/Permisos/i").first()).toBeVisible({ timeout: 8000 });
    }
  });

  // ── Operator can access pages after grant ─────────────────────────────────
  test("operator can access /operaciones after grant", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OPERATOR_EMAIL);
    await page.goto("/operaciones");
    await expectUnlocked(page, "/operaciones");
    // Should see module cards
    await expect(page.locator("text=Consola Técnica").first()).toBeVisible({ timeout: 8000 });
  });

  test("operator can access /operaciones/consola-tecnica after grant", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OPERATOR_EMAIL);
    await page.goto("/operaciones/consola-tecnica");
    await expectUnlocked(page, "/operaciones/consola-tecnica");
  });

  test("operator can access /operaciones/bitacora after grant", async ({ page, context }) => {
    await context.clearCookies();
    await loginWithClerkTicket(page, OPERATOR_EMAIL);
    await page.goto("/operaciones/bitacora");
    await expectUnlocked(page, "/operaciones/bitacora");
  });
});
