import { test, expect } from "@playwright/test";

/**
 * App instalable (PWA) de app.terah2o.com.
 *
 * El service worker solo se registra en producción: correr contra
 * `npm run build && npm run start` (o un preview), no contra `next dev`.
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/pwa.spec.ts
 */

test.describe("Manifest", () => {
  test("es válido para instalar y no pasa por el login", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.name).toContain("TeraH2O");
    expect(m.short_name).toBe("TeraH2O");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");

    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  });

  test("cada ícono existe, es PNG y responde sin sesión", async ({ request }) => {
    const m = await (await request.get("/manifest.webmanifest")).json();
    const icons = [...m.icons, { src: "/icons/apple-touch-icon.png" }];
    for (const { src } of icons) {
      const res = await request.get(src, { maxRedirects: 0 });
      expect(res.status(), src).toBe(200);
      expect(res.headers()["content-type"], src).toContain("image/png");
    }
  });

  test("el HTML enlaza el manifest y el ícono de Apple", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest"
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#05051a");
  });
});

test.describe("Service worker", () => {
  test("se registra, se activa y controla la página", async ({ page }) => {
    await page.goto("/");
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { state: reg.active?.state, script: reg.active?.scriptURL };
    });
    expect(state.state).toBe("activated");
    expect(state.script).toMatch(/\/sw\.js\?v=/);
  });

  test("sin conexión muestra la pantalla 'Sin conexión'", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // la primera carga aún no estaba controlada por el SW
    await context.setOffline(true);
    await page.goto("/academia").catch(() => null);
    await expect(page.getByText("Sin conexión a internet")).toBeVisible();
    await context.setOffline(false);
  });

  test("nunca guarda en caché /api ni HTML", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.evaluate(() => fetch("/api/check-subscription").catch(() => null));
    const urls = await page.evaluate(async () => {
      const out: string[] = [];
      for (const key of await caches.keys()) {
        const cache = await caches.open(key);
        for (const req of await cache.keys()) out.push(new URL(req.url).pathname);
      }
      return out;
    });
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u.startsWith("/_next/static/") || u.startsWith("/icons/"), u).toBe(true);
    }
  });
});

test.describe("Inicio de la app", () => {
  test("ya no tiene el botón de presentación institucional", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Presentación institucional")).toHaveCount(0);
  });

  test("en iPhone muestra 'Instalar app' con los pasos de Safari", async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.getByTestId("install-app-button").click();
    await expect(page.getByRole("dialog")).toContainText("Añadir a pantalla de inicio");
    await ctx.close();
  });

  test("abierta como app instalada no muestra 'Instalar app'", async ({ page }) => {
    await page.emulateMedia({ media: "screen" });
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q === "(display-mode: standalone)"
          ? ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
          : real(q);
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("install-app-button")).toHaveCount(0);
  });
});
