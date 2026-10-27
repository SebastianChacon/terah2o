// Genera los PNG de la app instalable a partir de public/icons/icon.svg.
//   node scripts/generate-icons.mjs
// "any" usa el SVG tal cual; "maskable" reduce el logotipo (grupo #fg) al 80 %
// sobre el fondo completo, para que Android lo recorte en círculo sin cortarlo.
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const svg = await readFile(path.join(root, "public/icons/icon.svg"), "utf8");
const toDataUrl = (src) =>
  `data:image/svg+xml;base64,${Buffer.from(src).toString("base64")}`;
const variants = {
  any: toDataUrl(svg),
  maskable: toDataUrl(
    svg.replace('<g id="fg">', '<g id="fg" transform="translate(256 256) scale(0.8) translate(-256 -256)">')
  ),
};

const outputs = [
  { file: "icon-192.png", size: 192, variant: "any" },
  { file: "icon-512.png", size: 512, variant: "any" },
  { file: "icon-maskable-512.png", size: 512, variant: "maskable" },
  { file: "apple-touch-icon.png", size: 180, variant: "any" },
];

// CHROMIUM_PATH permite usar un Chromium ya instalado (p.ej. en CI).
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage();
for (const { file, size, variant } of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0"><img src="${variants[variant]}" width="${size}" height="${size}" style="display:block"></body>`
  );
  await page.screenshot({ path: path.join(root, "public/icons", file) });
}
await browser.close();
console.log("Íconos generados en public/icons/");
