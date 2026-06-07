import { test, expect } from "@playwright/test";

test.describe("Login — toggle mostrar/ocultar contraseña", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("password-input")).toBeVisible({ timeout: 10000 });
  });

  test("campo contraseña inicia como type=password", async ({ page }) => {
    const input = page.getByTestId("password-input");
    await expect(input).toHaveAttribute("type", "password");
  });

  test("click ojo cambia type a text", async ({ page }) => {
    const input = page.getByTestId("password-input");
    const toggle = page.getByTestId("toggle-password");

    await expect(input).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(input).toHaveAttribute("type", "text");
  });

  test("segundo click vuelve a type=password", async ({ page }) => {
    const input = page.getByTestId("password-input");
    const toggle = page.getByTestId("toggle-password");

    await toggle.click();
    await expect(input).toHaveAttribute("type", "text");

    await toggle.click();
    await expect(input).toHaveAttribute("type", "password");
  });

  test("texto escrito es visible cuando showPassword=true", async ({ page }) => {
    const input = page.getByTestId("password-input");
    const toggle = page.getByTestId("toggle-password");

    await input.fill("miClave123");
    await toggle.click();
    await expect(input).toHaveValue("miClave123");
    await expect(input).toHaveAttribute("type", "text");
  });

  test("ojo funciona igual en modo Registrarse", async ({ page }) => {
    await page.locator("button", { hasText: /registrarse/i }).click();

    const input = page.getByTestId("password-input");
    const toggle = page.getByTestId("toggle-password");

    await expect(input).toHaveAttribute("type", "password");
    await toggle.click();
    await expect(input).toHaveAttribute("type", "text");
  });
});
