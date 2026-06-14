import { test, expect } from "@playwright/test";
import {
  buildMemoriaTecnicaHTML,
  type MemoriaData,
} from "../src/lib/export/memoriaTecnica";

const data: MemoriaData = {
  org: "Planta Función Ñañez",
  samplePoint: "Captación Río — Norte",
  flow: 10,
  hours: 24,
  params: [{ label: "Turbiedad (NTU)", val: 8 }],
  chemicals: [
    { name: "POLÍMERO ANIÓNICO 0.1%", func: "helper", conc: 0.1, price: 5 },
  ],
  targetDoses: { coag: 12, ph: 6.4, helper: 0.2, oxid: 1.3 },
  baselineAforos: {},
  observations: "Revisión técnica · válida",
};

// Reproduce EXACTAMENTE el mecanismo de bitácora (openHtmlInNewTab): blob URL
// abierto como documento. El mojibake original ocurría aquí, no en node.
async function renderViaBlob(
  page: import("@playwright/test").Page,
  html: string,
  mime: string,
): Promise<string> {
  await page.goto("about:blank");
  const url = await page.evaluate(
    ([h, m]) => URL.createObjectURL(new Blob([h], { type: m })),
    [html, mime] as const,
  );
  await page.goto(url);
  return page.evaluate(() => document.body.innerText);
}

test("FIX: blob text/html;charset=utf-8 → acentos correctos en navegador", async ({
  page,
}) => {
  const html = buildMemoriaTecnicaHTML(data);
  const text = await renderViaBlob(page, html, "text/html;charset=utf-8");
  expect(text).toContain("Función");
  expect(text).toContain("Ñañez");
  expect(text).toContain("POLÍMERO ANIÓNICO");
  expect(text).toContain("·");
  expect(text).not.toContain("Ã");
  expect(text).not.toContain("â€");
});

test("el <meta charset> protege incluso si el mime no trae charset", async ({
  page,
}) => {
  // El builder incluye <meta charset="utf-8">, así que aún con mime "pelado"
  // el navegador decodifica bien (defensa en profundidad).
  const html = buildMemoriaTecnicaHTML(data);
  const text = await renderViaBlob(page, html, "text/html");
  expect(text).toContain("Función");
  expect(text).not.toContain("Ã");
});

test("REGRESIÓN: sin meta y sin charset SÍ se rompe (causa raíz confirmada)", async ({
  page,
}) => {
  // HTML sin <meta charset> + blob sin charset = el bug original.
  const broken = "<html><head><title>x</title></head><body>MEMORIA TÉCNICA — Función ·</body></html>";
  const text = await renderViaBlob(page, broken, "text/html");
  // Demuestra que el fallo es real y que nuestro fix (meta + charset) lo evita.
  expect(text).toContain("Ã");
});
