import { test, expect } from "@playwright/test";

// Fill in your credentials before running.
const TEST_EMAIL = process.env.TEST_EMAIL ?? "chacontsebastian@gmail.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

test.describe("login flow", () => {
  test.beforeEach(async ({ context }) => {
    // Clear all cookies and localStorage so each run starts clean.
    await context.clearCookies();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
  });

  test("wrong password shows error, does not redirect", async ({ page }) => {
    await page.goto("/login");
    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill("wrong-password-xyz");
    await page.locator("button[type='submit']").click();

    // Must stay on login
    await page.waitForTimeout(4000);
    expect(page.url()).toContain("/login");
    // An error message should appear
    const error = page.locator("text=/contraseña|credencial|error/i");
    await expect(error).toBeVisible({ timeout: 5000 });
  });

  test("successful login reaches protected route and sets JWT cookie", async ({ page }) => {
    if (!TEST_PASSWORD) {
      test.skip(true, "Set TEST_PASSWORD env var to run this test");
      return;
    }

    // Capture all network responses for diagnostics
    const networkLog: string[] = [];
    page.on("response", (res) => {
      networkLog.push(`${res.status()} ${res.url()}`);
    });

    // Capture browser console logs
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().startsWith("[AUTH]")) consoleLogs.push(msg.text());
    });

    await page.goto("/login");
    await expect(page).toHaveURL(/login/);

    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill(TEST_PASSWORD);

    // Click and wait up to 12 s for navigation away from login
    await Promise.all([
      page.waitForURL((url) => !url.toString().includes("/login"), {
        timeout: 12000,
      }),
      page.locator("button[type='submit']").click(),
    ]);

    const finalUrl = page.url();
    console.log("Final URL:", finalUrl);
    console.log("Auth console logs:\n", consoleLogs.join("\n"));
    console.log("Network log (last 20):\n", networkLog.slice(-20).join("\n"));

    // Must have left the login page
    expect(finalUrl).not.toContain("/login");

    // JWT cookie must be present
    const cookies = await page.context().cookies();
    const jwtCookie = cookies.find((c) => c.name === "__convexAuthJWT");
    console.log(
      "Cookies:",
      cookies.map((c) => `${c.name}=${c.value.slice(0, 20)}...`)
    );
    expect(jwtCookie, "JWT cookie must be set after login").toBeTruthy();

    // Should land on a protected route (operaciones or the ?next= param)
    expect(finalUrl).toMatch(/\/(operaciones|dashboard|asistencia|academia)/);
  });

  test("authenticated user visiting /login is redirected to /operaciones", async ({
    page,
    context,
  }) => {
    if (!TEST_PASSWORD) {
      test.skip(true, "Set TEST_PASSWORD env var to run this test");
      return;
    }

    // First: log in to get the JWT cookie
    await page.goto("/login");
    await page.locator("input[type='email']").fill(TEST_EMAIL);
    await page.locator("input[type='password']").fill(TEST_PASSWORD);
    await Promise.all([
      page.waitForURL((url) => !url.toString().includes("/login"), {
        timeout: 12000,
      }),
      page.locator("button[type='submit']").click(),
    ]);

    // Verify cookie is present
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "__convexAuthJWT")).toBeTruthy();

    // Now navigate back to /login — proxy should redirect away
    await page.goto("/login");
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain("/login");
  });

  test("unauthenticated user is blocked from protected routes", async ({ page }) => {
    await page.goto("/operaciones");
    // proxy.ts redirects to /login?next=/operaciones
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });
});
