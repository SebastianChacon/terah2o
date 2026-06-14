import { test, expect } from "@playwright/test";
import {
  buildMemoriaTecnicaHTML,
  type MemoriaData,
} from "../src/lib/export/memoriaTecnica";

// Datos con TODOS los caracteres que antes se rompían (mojibake):
// acentos, em-dash (—), middot (·), Ñ.
const baseData: MemoriaData = {
  org: "Planta Función Ñañez",
  samplePoint: "Captación Río — Norte",
  flow: 10,
  hours: 24,
  params: [
    { label: "Turbiedad (NTU)", val: 8 },
    { label: "pH Crudo", val: 7 },
  ],
  chemicals: [
    { name: "POLÍMERO ANIÓNICO 0.1%", func: "helper", conc: 0.1, price: 5 },
    { name: "SULFATO DE ALUMINIO 10%", func: "coag", conc: 10, price: 1.2 },
  ],
  targetDoses: { coag: 12, ph: 6.4, helper: 0.2, oxid: 1.3 },
  baselineAforos: { "SULFATO DE ALUMINIO 10%": 4 },
  observations: "Operación válida · revisión técnica",
  exportId: 123,
  exportDate: "1/1/2026",
};

// Secuencias que aparecen cuando UTF-8 se lee como Latin-1.
const MOJIBAKE = ["Ã", "â€", "Â"];

test("HTML declara charset utf-8", () => {
  const html = buildMemoriaTecnicaHTML(baseData);
  expect(html).toContain('<meta charset="utf-8">');
});

test("conserva acentos / em-dash / middot sin mojibake", () => {
  const html = buildMemoriaTecnicaHTML(baseData);
  expect(html).toContain("POLÍMERO ANIÓNICO 0.1%");
  expect(html).toContain("Función");
  expect(html).toContain("Ñañez");
  expect(html).toContain("·");
  for (const bad of MOJIBAKE) {
    expect(html, `no debe contener mojibake "${bad}"`).not.toContain(bad);
  }
});

test("con baseline: render 6 secciones (comparativa + economía)", () => {
  const html = buildMemoriaTecnicaHTML(baseData);
  expect(html).toContain("MEMORIA TECNICA DE OPTIMIZACION");
  expect(html).toContain("Comparativa: Linea Base");
  expect(html).toContain("6. Observaciones Tecnicas Finales");
  expect(html).toContain("AHORRO DETECTADO");
});

test("sin baseline (sesión legacy): degrada con nota, no rompe", () => {
  const html = buildMemoriaTecnicaHTML({
    ...baseData,
    baselineAforos: {},
    targetDoses: { coag: 0, ph: 0, helper: 0, oxid: 0 },
  });
  expect(html).toContain("MEMORIA TECNICA DE DISENO");
  expect(html).toContain("Sin línea base registrada");
  expect(html).not.toContain("Comparativa: Linea Base");
  expect(html).toContain("5. Observaciones Tecnicas Finales");
});

test("plan de dosificación usa las dosis meta (consumo recomputado)", () => {
  const html = buildMemoriaTecnicaHTML(baseData);
  // Aforo sugerido coag = (12 * 10 * 60) / (10 * 10) = 72.0 ml/min
  expect(html).toContain("72.0 ml/min");
});
