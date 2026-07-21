// Generador único de la "Memoria Técnica" en HTML, compartido por la Consola
// Técnica (export en vivo) y la Bitácora (export desde sesión guardada).
//
// Objetivo: ambas rutas producen EXACTAMENTE el mismo documento. El HTML
// incluye `<meta charset="utf-8">` para evitar el mojibake que aparecía al
// abrir el reporte vía Blob URL sin charset declarado (los bytes UTF-8 de
// acentos / em-dash se interpretaban como Latin-1: `MEMORIA TÃ‰CNICA â€"`).

export type ChemFunc = "coag" | "ph" | "helper" | "oxid";

export interface MemoriaChemical {
  name: string;
  func: string; // ChemFunc en la práctica, pero el schema lo guarda como string
  conc: number; // concentración (%)
  price: number; // precio por kg (USD)
}

export interface MemoriaParam {
  label: string;
  val: number;
}

export interface MemoriaData {
  org: string;
  samplePoint: string;
  flow: number; // L/s
  hours: number; // h/día
  params: MemoriaParam[];
  chemicals: MemoriaChemical[];
  /** Dosis meta por función (coag/ph/helper/oxid) en mg/L. */
  targetDoses: Record<ChemFunc, number>;
  /** Aforo base por nombre de químico (ml/min). Opcional → sin baseline. */
  baselineAforos?: Record<string, number>;
  aiDiagnosis?: string;
  observations?: string;
  generatedBy?: string;
  exportId?: number;
  exportDate?: string;
}

/** Reproduce la fórmula de la Consola (calcBaselineMgL). */
function calcBaselineMgL(aforo: number, conc: number, flow: number): number {
  if (flow <= 0) return 0;
  return (aforo * conc * 10) / (flow * 60);
}

/**
 * Construye el HTML de la Memoria Técnica. Función pura y determinista
 * (salvo `exportId`/`exportDate` por defecto). Mismo markup/CSS que la
 * Consola Técnica.
 */
export function buildMemoriaTecnicaHTML(data: MemoriaData): string {
  const {
    org,
    samplePoint,
    flow,
    hours,
    params,
    chemicals,
    targetDoses,
    baselineAforos = {},
    aiDiagnosis,
    observations,
    generatedBy = "TeraH2O",
  } = data;

  const exportId = data.exportId ?? new Date().getTime();
  const exportDate = data.exportDate ?? new Date().toLocaleString();

  const dailyVolume = flow * 3.6 * hours;
  const volMonth = dailyVolume * 30;

  const getDose = (func: string): number =>
    targetDoses[func as ChemFunc] ?? 0;

  // ── Baseline (comparativa) ──────────────────────────────────────────────
  const hasBaseline = Object.values(baselineAforos).some((v) => v > 0);

  const baselineData = chemicals.map((c) => {
    const aforo = baselineAforos[c.name] ?? 0;
    return {
      name: c.name,
      aforo,
      mgl: calcBaselineMgL(aforo, c.conc, flow),
    };
  });

  // ── Economía (recomputada igual que la Consola) ─────────────────────────
  const financeRows = chemicals.map((c) => {
    const dose = getDose(c.func);
    const kgMonth = (dose * volMonth) / 1000;
    const cost = kgMonth * c.price;
    const baseAforo = baselineAforos[c.name] ?? 0;
    const baseDose = calcBaselineMgL(baseAforo, c.conc, flow);
    const baseCost = ((baseDose * volMonth) / 1000) * c.price;
    return { cost, baseCost };
  });
  const totalOptCost = financeRows.reduce((s, r) => s + r.cost, 0);
  const totalBaseCost = financeRows.reduce((s, r) => s + r.baseCost, 0);
  const savings = hasBaseline ? totalBaseCost - totalOptCost : 0;
  const efficiency = totalBaseCost > 0 ? (savings / totalBaseCost) * 100 : 0;
  const costPerM3 = volMonth > 0 ? totalOptCost / volMonth : 0;

  const title = hasBaseline
    ? "MEMORIA TÉCNICA DE OPTIMIZACIÓN"
    : "MEMORIA TÉCNICA DE DISEÑO Y POTABILIZACIÓN";

  const activeDoses = {
    coag: getDose("coag"),
    ph: getDose("ph"),
    helper: getDose("helper"),
    oxid: getDose("oxid"),
  };

  return `<html><head><meta charset="utf-8"><title>Memoria Técnica - Tera Engineering</title>
      <style>
        body{font-family:sans-serif;padding:35px;color:#0a192f;line-height:1.4;font-size:10px}
        .header{display:flex;justify-content:space-between;border-bottom:3px solid #0a192f;padding-bottom:15px;margin-bottom:20px}
        .section-title{background:#f1f5f9;padding:8px;font-weight:900;text-transform:uppercase;margin:15px 0 8px 0;border-left:5px solid #0ea5e9;font-size:10px}
        table{width:100%;border-collapse:collapse;margin-bottom:12px}
        th{background:#0a192f;color:white;padding:8px;text-align:left;font-size:9px}
        td{border:1px solid #e2e8f0;padding:8px}
        .highlight-box{background:#dcfce7;padding:12px;border-radius:6px;border:1px solid #10b981;margin:10px 0}
        .param-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;border:1px solid #e2e8f0;padding:12px;border-radius:6px}
        .ai-box{background:#f5f3ff;padding:12px;border-radius:6px;border:1px solid #8b5cf6;font-style:italic;margin-top:10px;color:#4c1d95}
        .note{background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:8px 12px;font-size:9px;color:#854d0e;margin:8px 0}
        .footer{margin-top:40px;text-align:center;border-top:1px solid #eee;padding-top:15px}
      </style></head><body>
      <div class="header"><div><h1 style="margin:0;font-size:20px">${title}</h1><p style="margin:3px 0;font-weight:bold">TeraH2O - Ingeniería de Potabilización</p><p style="margin:2px 0;color:#64748b">Generado por: <b>${generatedBy}</b></p></div><div style="text-align:right"><b>EXP:</b> ${exportId}<br><b>Fecha:</b> ${exportDate}</div></div>
      <div class="section-title">1. Resumen Operativo de Planta</div>
      <table><tr><td><b>Entidad:</b></td><td>${org}</td><td><b>Horas Operación:</b></td><td>${hours} h/día</td></tr><tr><td><b>Caudal:</b></td><td>${flow} L/s</td><td><b>Volumen/Día:</b></td><td>${dailyVolume.toFixed(1)} m3</td></tr><tr><td><b>Ubicación:</b></td><td colspan="3">${samplePoint || "S/N"}</td></tr></table>
      <div class="section-title">2. Caracterización Integral del Agua Cruda</div>
      <div class="param-grid">${params.map((p) => `<div><b>${p.label}:</b> ${p.val}</div>`).join("")}</div>
      ${aiDiagnosis ? `<div class="ai-box"><b>Diagnóstico IA Expert:</b> ${aiDiagnosis}</div>` : ""}
      ${
        hasBaseline
          ? `<div class="section-title">3. Comparativa: Línea Base vs. Optimización Proyectada</div><table><thead><tr><th>Insumo Técnico</th><th>Aforo Base</th><th>Dosis Base</th><th>Dosis Meta</th><th>Diferencia</th></tr></thead><tbody>${baselineData
              .map((b) => {
                const chem = chemicals.find((c) => c.name === b.name);
                const optDose = chem ? getDose(chem.func) : 0;
                return `<tr><td>${b.name}</td><td>${b.aforo.toFixed(1)} ml/min</td><td>${b.mgl.toFixed(1)} mg/L</td><td>${optDose.toFixed(1)} mg/L</td><td>${(optDose - b.mgl).toFixed(1)} mg/L</td></tr>`;
              })
              .join("")}</tbody></table>`
          : `<div class="note">Sin línea base registrada en esta sesión: se omite la comparativa de optimización.</div>`
      }
      <div class="section-title">${hasBaseline ? "4" : "3"}. Validación de Laboratorio y Plan de Dosificación</div>
      <div class="highlight-box"><b>DOSIS VALIDADA:</b> Configuración técnica para cumplimiento INEN 1108.<br><br><b>Coagulación:</b> ${activeDoses.coag.toFixed(1)} mg/L | <b>Regulación pH:</b> ${activeDoses.ph.toFixed(1)} mg/L | <b>Floculación:</b> ${activeDoses.helper.toFixed(1)} mg/L | <b>Oxidación:</b> ${activeDoses.oxid.toFixed(1)} mg/L</div>
      <table><thead><tr><th>Insumo</th><th>Aforo Sugerido (ml/min)</th><th>Consumo Diario (kg)</th><th>Consumo Mensual (kg)</th></tr></thead><tbody>${chemicals
        .map((c) => {
          const d = getDose(c.func);
          const aforo = c.conc > 0 ? (d * flow * 60) / (c.conc * 10) : 0;
          const dailyKg = (d * flow * 3.6 * hours) / 1000;
          const monthlyKg = dailyKg * 30;
          return `<tr><td>${c.name}</td><td>${aforo.toFixed(1)} ml/min</td><td>${dailyKg.toFixed(2)} kg</td><td>${monthlyKg.toFixed(1)} kg</td></tr>`;
        })
        .join("")}</tbody></table>
      <div class="section-title">${hasBaseline ? "5" : "4"}. Análisis Económico y Eficiencia</div>
      <div style="background:#0a192f;color:white;padding:15px;border-radius:6px;display:grid;grid-template-columns:repeat(${hasBaseline ? 3 : 2}, 1fr);gap:10px">
        <div>COSTO UNITARIO:<br><b>${costPerM3.toFixed(4)} USD/m3</b></div><div>INVERSIÓN MES:<br><b>$ ${totalOptCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</b></div>${hasBaseline ? `<div>AHORRO DETECTADO:<br><b>$ ${savings > 0 ? savings.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}</b><br><small>Eficiencia: ${efficiency.toFixed(1)}%</small></div>` : ""}
      </div>
      <div class="section-title">${hasBaseline ? "6" : "5"}. Observaciones Técnicas Finales</div>
      <div style="padding:10px;border:1px solid #e2e8f0;min-height:70px;font-style:italic">${observations || "Sin observaciones."}</div>
      <div class="footer"><p>TeraH2O - Software de Ingeniería de Tratamiento de Agua Potable</p><br><b>__________________________</b><br>DOCUMENTO VÁLIDO DIGITALMENTE</div></body></html>`;
}
