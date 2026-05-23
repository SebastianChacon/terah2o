/**
 * DIAGNÓSTICO DE PRODUCCIÓN — terah2o.vercel.app
 * Caveman-style: captura TODO lo que pasa en red, consola y cookies.
 */
import { test, expect } from "@playwright/test";

const PROD_URL = "https://terah2o.vercel.app";
const EMAIL = "carlos.test.777@ptap.ec";
const PASSWORD = "segura1234";
const WAIT_MS = 15_000;

test.use({ baseURL: PROD_URL });

test("PROD — diagnóstico completo de login", async ({ page, context }) => {
  await context.clearCookies();

  // ── Captura de red ─────────────────────────────────────────────────────
  const networkLog: { status: number; method: string; url: string; body?: string }[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("convex") || url.includes("/api/") || url.includes("/login") || url.includes("/operaciones") || url.includes("vercel")) {
      networkLog.push({ status: 0, method: req.method(), url });
    }
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("convex") || url.includes("/api/") || url.includes("/login") || url.includes("/operaciones") || url.includes("vercel")) {
      let body = "";
      try { if (res.headers()["content-type"]?.includes("json")) body = JSON.stringify(await res.json()); } catch {}
      networkLog.push({ status: res.status(), method: "RESP", url, body: body.slice(0, 300) });
    }
  });

  // ── Captura de consola ─────────────────────────────────────────────────
  const consoleLogs: string[] = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`));

  // ── Errores JS ────────────────────────────────────────────────────────
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  // ── WebSocket ─────────────────────────────────────────────────────────
  const wsEvents: string[] = [];
  page.on("websocket", (ws) => {
    wsEvents.push(`WS OPEN: ${ws.url()}`);
    ws.on("framesent", (f) => wsEvents.push(`WS SENT: ${(typeof f.payload === "string" ? f.payload : "[binary]").slice(0, 200)}`));
    ws.on("framereceived", (f) => wsEvents.push(`WS RECV: ${(typeof f.payload === "string" ? f.payload : "[binary]").slice(0, 300)}`));
    ws.on("close", () => wsEvents.push(`WS CLOSE`));
  });

  // ── Paso 1: Cargar /login ─────────────────────────────────────────────
  console.log("\n>>> PASO 1: Cargar /login");
  await page.goto(`${PROD_URL}/login`);
  await page.waitForLoadState("networkidle");
  console.log("URL después de cargar:", page.url());

  const cookiesBefore = await context.cookies(PROD_URL);
  console.log("Cookies ANTES:", cookiesBefore.map(c => `${c.name}=${c.value.slice(0,30)}`).join(", ") || "ninguna");

  await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 6000 });
  console.log("✓ Formulario visible");

  // ── Paso 2: Credenciales ──────────────────────────────────────────────
  consoleLogs.length = 0; // reset para capturar solo desde click
  await page.locator("input[type='email']").fill(EMAIL);
  await page.locator("input[type='password']").fill(PASSWORD);
  console.log(">>> PASO 2: Click submit");

  const startTime = Date.now();
  let timedOut = false;
  let finalUrl = "";

  await page.locator("button[type='submit']").click();

  try {
    await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: WAIT_MS });
    finalUrl = page.url();
    console.log(`✓ Salió de /login → ${finalUrl} (${Date.now()-startTime}ms)`);
  } catch {
    timedOut = true;
    finalUrl = page.url();
    console.log(`✗ TIMEOUT (${Date.now()-startTime}ms). URL: ${finalUrl}`);
  }

  // ── Estado final ─────────────────────────────────────────────────────
  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 400);
  console.log("\n>>> TEXTO EN PANTALLA:\n", bodyText);

  const cookiesAfter = await context.cookies(PROD_URL);
  console.log("\n>>> COOKIES DESPUÉS:");
  cookiesAfter.forEach(c => console.log(`  ${c.name}=${c.value.slice(0,50)} [${c.domain}]`));

  const lsKeys = await page.evaluate(() => Object.keys(localStorage)).catch(() => [] as string[]);
  console.log("\n>>> localStorage keys:", lsKeys.join(", ") || "vacío");
  for (const k of lsKeys.filter(k => k.includes("JWT") || k.includes("convex"))) {
    const v = await page.evaluate((key) => localStorage.getItem(key)?.slice(0,80) ?? "", k);
    console.log(`  ${k} = ${v}`);
  }

  console.log("\n>>> CONSOLE LOGS DEL BROWSER:");
  consoleLogs.forEach(l => console.log(" ", l));

  if (pageErrors.length) {
    console.log("\n>>> PAGE ERRORS:");
    pageErrors.forEach(e => console.log("  ✗", e));
  }

  console.log("\n>>> WEBSOCKET EVENTS (primeros 25):");
  wsEvents.slice(0, 25).forEach(e => console.log(" ", e));

  console.log("\n>>> NETWORK LOG:");
  networkLog.forEach(r => {
    if (r.method === "RESP") console.log(`  [${r.status}] ${r.url.slice(0,100)}${r.body ? " → "+r.body.slice(0,150) : ""}`);
    else console.log(`  → ${r.method} ${r.url.slice(0,100)}`);
  });

  // ── Evaluación JS en página ───────────────────────────────────────────
  const jsState = await page.evaluate(() => ({
    href: location.href,
    cookies: document.cookie.split(";").map(s => s.trim().split("=")[0]),
    perf: Math.round(performance.now()),
  })).catch(() => null);
  console.log("\n>>> JS STATE:", JSON.stringify(jsState));

  // No rompemos el test para que SIEMPRE loguee todo
  if (timedOut) {
    console.log("\n⚠️  VEREDICTO: Login TRABADO. Revisar logs arriba para causa.");
  } else {
    console.log("\n✓ VEREDICTO: Login OK.");
    expect(finalUrl).not.toContain("/login");
  }
});
