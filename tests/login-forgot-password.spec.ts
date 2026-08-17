import { test, expect } from "@playwright/test";
import { ensureClerkUser, verifyClerkPassword } from "./helpers/clerk-login";

/**
 * Recuperación de contraseña en /login (Clerk — reset_password_email_code).
 *
 * El flujo real se prueba con un "test email" de Clerk: en instancias de
 * desarrollo (pk_test/sk_test) cualquier correo con el sufijo +clerk_test NO
 * recibe correo real y su código de verificación siempre es 424242.
 */
const RESET_EMAIL = "terah2o.reset+clerk_test@example.com";
const CLERK_TEST_CODE = "424242";
const OLD_PASSWORD = "ClaveVieja-2026-Aa1";

test.describe("Login — ¿Olvidaste tu contraseña? (UI)", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/login");
    await expect(page.getByTestId("password-input")).toBeVisible({ timeout: 15000 });
  });

  test("el enlace se muestra en Ingresar y se oculta en Registrarse", async ({ page }) => {
    await expect(page.getByTestId("forgot-password-link")).toBeVisible();

    await page.locator("button", { hasText: /registrarse/i }).click();
    await expect(page.getByTestId("forgot-password-link")).toHaveCount(0);
  });

  test("el enlace abre el formulario de recuperación", async ({ page }) => {
    await page.getByTestId("forgot-password-link").click();

    await expect(page.getByTestId("reset-request-form")).toBeVisible();
    await expect(page.getByTestId("reset-email-input")).toBeVisible();
    await expect(page.getByTestId("reset-request-submit")).toBeVisible();
    // El formulario de login queda oculto mientras dure la recuperación
    await expect(page.getByTestId("password-input")).toHaveCount(0);
  });

  test("el correo escrito en el login se arrastra al formulario de recuperación", async ({ page }) => {
    await page.locator("input[type='email']").fill("operador@ptap.ec");
    await page.getByTestId("forgot-password-link").click();

    await expect(page.getByTestId("reset-email-input")).toHaveValue("operador@ptap.ec");
  });

  test("'Volver a ingresar' regresa al login", async ({ page }) => {
    await page.getByTestId("forgot-password-link").click();
    await expect(page.getByTestId("reset-request-form")).toBeVisible();

    await page.getByTestId("reset-back-link").click();

    await expect(page.getByTestId("password-input")).toBeVisible();
    await expect(page.getByTestId("reset-request-form")).toHaveCount(0);
  });

  test("correo sin cuenta muestra error y no avanza al paso del código", async ({ page }) => {
    await page.getByTestId("forgot-password-link").click();
    await page.getByTestId("reset-email-input").fill("no-existe-terah2o-xyz@ptap.ec");
    await page.getByTestId("reset-request-submit").click();

    await expect(page.getByTestId("reset-error")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("reset-error")).toContainText(/no existe|cuenta/i);
    await expect(page.getByTestId("reset-code-form")).toHaveCount(0);
    expect(page.url()).toContain("/login");
  });
});

test.describe("Login — recuperación de contraseña end-to-end", () => {
  let userId: string;
  const NEW_PASSWORD = `ClaveNueva-${Date.now()}-Zz9`;

  test.beforeAll(async () => {
    // Estado inicial conocido: la cuenta existe y su contraseña es la vieja.
    userId = await ensureClerkUser(RESET_EMAIL, OLD_PASSWORD);
    expect(await verifyClerkPassword(userId, OLD_PASSWORD)).toBe(true);
  });

  test("código correcto fija la contraseña nueva e inicia sesión", async ({ page, context }) => {
    test.setTimeout(90000);
    await context.clearCookies();
    await page.goto("/login");

    await page.getByTestId("forgot-password-link").click();
    await page.getByTestId("reset-email-input").fill(RESET_EMAIL);
    await page.getByTestId("reset-request-submit").click();

    await expect(page.getByTestId("reset-code-form")).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId("reset-info")).toContainText(RESET_EMAIL);

    // El ojo mostrar/ocultar también aplica a la contraseña nueva
    await expect(page.getByTestId("new-password-input")).toHaveAttribute("type", "password");
    await page.getByTestId("toggle-new-password").click();
    await expect(page.getByTestId("new-password-input")).toHaveAttribute("type", "text");
    await page.getByTestId("toggle-new-password").click();

    // Código incorrecto primero: debe mostrar error y mantener el formulario.
    await page.getByTestId("reset-code-input").fill("111111");
    await page.getByTestId("new-password-input").fill(NEW_PASSWORD);
    await page.getByTestId("reset-confirm-submit").click();
    await expect(page.getByTestId("reset-error")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("reset-code-form")).toBeVisible();

    // Código correcto (test email de Clerk).
    await page.getByTestId("reset-code-input").fill(CLERK_TEST_CODE);
    await page.getByTestId("new-password-input").fill(NEW_PASSWORD);
    await page.getByTestId("reset-confirm-submit").click();

    // Sesión creada -> el useEffect único navega fuera de /login
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 40000 });
    expect(page.url()).not.toContain("/login");

    // Cookie de sesión de Clerk presente
    const cookies = await page.context().cookies();
    expect(
      cookies.some((c) => c.name === "__session" || c.name.startsWith("__clerk") || c.name === "__client_uat"),
      "debe existir cookie de sesión de Clerk"
    ).toBeTruthy();
  });

  test("la contraseña nueva es la vigente en Clerk y la vieja ya no sirve", async () => {
    expect(await verifyClerkPassword(userId, NEW_PASSWORD)).toBe(true);
    expect(await verifyClerkPassword(userId, OLD_PASSWORD)).toBe(false);
  });
});
