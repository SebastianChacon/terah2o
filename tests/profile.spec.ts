import { test, expect } from "@playwright/test";
import { loginWithClerkTicket } from "./helpers/clerk-login";
import { seedTestData } from "./helpers/seed-test-data";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "chacontsebastian@gmail.com";

/**
 * Login and wait for Convex auth + UserSync to initialize.
 * UserSync fires upsertCurrentUser once isAuthenticated flips — it needs a moment
 * on the destination page before the Convex WebSocket handshake completes.
 */
async function loginAndWaitForSync(page: Parameters<typeof loginWithClerkTicket>[0]) {
  await loginWithClerkTicket(page, TEST_EMAIL);
  await page.waitForLoadState("networkidle");
  // Give UserSync time to fire upsertCurrentUser and merge any old records
  await page.waitForTimeout(3000);
}

test.describe("profile page", () => {
  test.beforeAll(async () => {
    // Ensure test user has org + subscription in Convex DB
    await seedTestData(TEST_EMAIL);
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  // ── Datos de usuario aparecen tras login ──────────────────────────────
  test("profile shows user data after login", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/dashboard/profile");

    // Wait for data to load (spinner disappears)
    await expect(page.locator(".animate-spin")).not.toBeVisible({ timeout: 15000 });

    // Role must show
    await expect(page.locator("text=Administrador")).toBeVisible({ timeout: 10000 });

    // Name must not be the placeholder
    const userName = page.locator("p.text-white.font-semibold.text-lg");
    await expect(userName).not.toHaveText("Sin nombre", { timeout: 10000 });

    // Email must be visible and non-empty
    const emailEl = page.locator("p.text-white\\/40.text-sm.font-mono");
    await expect(emailEl).not.toBeEmpty({ timeout: 5000 });

    // Subscription heading always present (use role locator to avoid strict mode conflict)
    await expect(
      page.getByRole("heading", { name: "Suscripción" })
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Org card muestra cuando existe organización ───────────────────────
  test("profile shows organization card", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/dashboard/profile");

    await expect(page.locator(".animate-spin")).not.toBeVisible({ timeout: 15000 });

    await expect(
      page.getByRole("heading", { name: "Organización" })
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Suscripción activa o en prueba ────────────────────────────────────
  test("profile shows active or trialing subscription", async ({ page }) => {
    await loginAndWaitForSync(page);
    await page.goto("/dashboard/profile");

    await expect(page.locator(".animate-spin")).not.toBeVisible({ timeout: 15000 });

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const hasActiveStatus = /Activo|prueba|trialing|Prueba/i.test(bodyText);
    expect(hasActiveStatus, `Expected active/trial status. Page text: ${bodyText}`).toBe(true);
  });

  // ── Perfil carga con status 200 (sin redirect) ────────────────────────
  test("profile page returns 200 for authenticated user", async ({ page }) => {
    await loginWithClerkTicket(page, TEST_EMAIL);

    const response = await page.goto("/dashboard/profile");
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/dashboard/profile");
  });
});
