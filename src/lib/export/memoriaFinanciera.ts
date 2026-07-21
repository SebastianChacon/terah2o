// Generador único de la "Memoria de Gestión Financiera" en HTML, compartido por
// el módulo Finanzas (export en vivo al generar el informe) y la Bitácora
// (export desde el registro guardado en Convex).
//
// Objetivo: ambas rutas producen EXACTAMENTE el mismo documento. Antes, Finanzas
// generaba un PDF rico inline y la Bitácora un PDF mínimo de 5 filas que no
// coincidía ni en datos ni en diseño. Este builder es la única fuente de verdad.
//
// El HTML incluye `<meta charset="utf-8">` para evitar mojibake al abrirlo vía
// Blob URL (los bytes UTF-8 de acentos / m³ se interpretarían como Latin-1).

export interface MemoriaFinHR {
  role: string;
  quantity: number;
  salary: number;
  subtotal: number;
}

export interface MemoriaFinExpenses {
  energy: number;
  internet: number;
  pettyCash: number;
  maintenance: number;
}

export interface MemoriaFinChemical {
  name: string;
  dose?: number; // mg/L (modo projection)
  totalKg?: number; // kg (modo analysis)
  pricePerKg: number;
  monthlyCost: number;
}

export interface MemoriaFinancieraData {
  instName: string;
  mode: "projection" | "analysis";
  /** Fecha mostrada en el encabezado. Default: hoy (locale). */
  dateLabel?: string;
  volumeMonth: number;
  billableVolume: number;
  costPerM3: number;
  hrRows: MemoriaFinHR[];
  expenses: MemoriaFinExpenses;
  chemicals: MemoriaFinChemical[];
  totalChemicals: number;
  totalLabor: number;
  grandTotal: number;
  userRate: number;
  breakEvenRate: number;
  revenue: number;
  profit: number;
  aiResponse?: string;
  /** Si true, anexa script de auto-impresión (usado por Finanzas en vivo). */
  autoPrint?: boolean;
}

const fmtUSD = (n: number) =>
  `$${(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Construye el HTML de la Memoria de Gestión Financiera. Función pura y
 * determinista (salvo `dateLabel` por defecto). Mismo markup/CSS en Finanzas
 * y Bitácora.
 */
export function buildMemoriaFinancieraHTML(data: MemoriaFinancieraData): string {
  const {
    instName,
    mode,
    volumeMonth,
    billableVolume,
    costPerM3,
    hrRows,
    expenses,
    chemicals,
    totalChemicals,
    totalLabor,
    grandTotal,
    userRate,
    breakEvenRate,
    revenue,
    profit,
    aiResponse,
    autoPrint = false,
  } = data;

  const dateLabel = data.dateLabel ?? new Date().toLocaleDateString();

  const chemRows = chemicals
    .map(
      (c) =>
        `<tr><td>${c.name}</td><td>${
          mode === "projection"
            ? `${c.dose ?? 0} mg/L`
            : `${c.totalKg ?? 0} kg`
        }</td><td>${fmtUSD(c.pricePerKg)}</td><td>${fmtUSD(c.monthlyCost)}</td></tr>`
    )
    .join("");

  const hrRowsHtml = hrRows
    .map(
      (h) =>
        `<tr><td>${h.role}</td><td>${h.quantity}</td><td>${fmtUSD(
          h.salary
        )}</td><td>${fmtUSD(h.subtotal)}</td></tr>`
    )
    .join("");

  const totalOther =
    (expenses?.energy ?? 0) +
    (expenses?.internet ?? 0) +
    (expenses?.pettyCash ?? 0) +
    (expenses?.maintenance ?? 0);

  const printScript = autoPrint
    ? `<script>window.onload=function(){window.print()}<\/script>`
    : "";

  return `<html><head><meta charset="utf-8"><title>Memoria de Gestión Financiera - ${instName}</title>
    <style>body{font-family:sans-serif;color:#0a192f;padding:40px;font-size:11px}
    .header{border-bottom:5px solid #f59e0b;padding-bottom:10px;margin-bottom:25px;display:flex;justify-content:space-between}
    h1{font-size:22px;margin:0;font-style:italic;text-transform:uppercase}
    h3{text-transform:uppercase;color:#0a192f;border-bottom:2px solid #e2e8f0;padding-bottom:5px;margin-top:25px;font-size:13px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:20px 0}
    .card{border:1px solid #e2e8f0;padding:15px;border-radius:8px;background:#f8fafc}
    .card b{display:block;color:#64748b;font-size:9px;text-transform:uppercase;margin-bottom:5px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#0a192f;color:white;padding:10px;font-size:10px;text-transform:uppercase}
    td{border:1px solid #e2e8f0;padding:8px;text-align:center}
    .footer{background:#0a192f;color:white;padding:30px;border-radius:15px;text-align:center;margin-top:40px}</style></head><body>
    <div class="header"><div><h1>Memoria de Gestión Financiera</h1>
    <p><b>Institución:</b> ${instName}</p><p><b>Fecha:</b> ${dateLabel}</p></div>
    <div style="background:#0a192f;color:white;padding:6px 12px;border-radius:6px;font-size:10px;text-transform:uppercase;font-weight:900;height:fit-content">MODO: ${mode.toUpperCase()}</div></div>
    <div class="grid">
      <div class="card"><b>Volumen Mes</b><span style="font-size:16px;font-weight:900">${volumeMonth.toFixed(0)} m³</span></div>
      <div class="card"><b>Vol. Facturable</b><span style="font-size:16px;font-weight:900">${billableVolume.toFixed(0)} m³</span></div>
      <div class="card"><b>Costo/m³</b><span style="font-size:16px;font-weight:900">$${costPerM3.toFixed(4)}</span></div>
    </div>
    <h3>Recurso Humano</h3>
    <table><thead><tr><th>Cargo</th><th>N°</th><th>Unitario</th><th>Total</th></tr></thead><tbody>
    ${hrRowsHtml}
    <tr style="font-weight:900;background:#f8fafc"><td colspan="3" style="text-align:right">Subtotal Personal</td><td>${fmtUSD(totalLabor)}</td></tr>
    </tbody></table>
    <h3>Matriz Química</h3>
    <table><thead><tr><th>Nombre</th><th>Cantidad</th><th>Precio</th><th>Gasto</th></tr></thead><tbody>${chemRows}
    <tr style="font-weight:900;background:#f8fafc"><td colspan="3" style="text-align:right">Subtotal Químicos</td><td>${fmtUSD(totalChemicals)}</td></tr>
    </tbody></table>
    <h3>Gastos Operativos</h3>
    <table><thead><tr><th>Concepto</th><th>Monto Mensual</th></tr></thead><tbody>
    <tr><td>Energía Eléctrica</td><td>${fmtUSD(expenses?.energy ?? 0)}</td></tr>
    <tr><td>Internet / Conectividad</td><td>${fmtUSD(expenses?.internet ?? 0)}</td></tr>
    <tr><td>Caja Chica</td><td>${fmtUSD(expenses?.pettyCash ?? 0)}</td></tr>
    <tr><td>Mantenimiento / Otros</td><td>${fmtUSD(expenses?.maintenance ?? 0)}</td></tr>
    <tr style="font-weight:900;background:#f8fafc"><td style="text-align:right">Subtotal Operativo</td><td>${fmtUSD(totalOther)}</td></tr>
    </tbody></table>
    <h3>Punto de Equilibrio y Tarifas</h3>
    <div class="grid">
      <div class="card"><b>Tarifa Aplicada</b><span style="font-size:16px;font-weight:900">${fmtUSD(userRate)}/m³</span></div>
      <div class="card"><b>Tarifa Equilibrio</b><span style="font-size:16px;font-weight:900">$${breakEvenRate.toFixed(4)}/m³</span></div>
      <div class="card"><b>Recaudación Proyectada</b><span style="font-size:16px;font-weight:900">${fmtUSD(revenue)}</span></div>
    </div>
    ${
      aiResponse
        ? `<div style="background:#fdfaff;border:1px solid #ddd6fe;border-radius:8px;padding:20px;margin-top:25px"><h4 style="margin-top:0;color:#8b5cf6;text-transform:uppercase;font-size:11px">ANÁLISIS IA</h4><div>${aiResponse.replace(
            /\n/g,
            "<br>"
          )}</div></div>`
        : ""
    }
    <div class="footer"><p style="margin:0;font-size:11px;opacity:.8;font-weight:700;text-transform:uppercase">Inversión Mensual Total</p>
    <h2 style="font-size:42px;margin:10px 0">${fmtUSD(grandTotal)}</h2>
    <div style="display:inline-block;padding:8px 20px;border-radius:50px;background:${
      profit >= 0 ? "#10b981" : "#f43f5e"
    };font-weight:900;font-size:14px">
    MARGEN NETO: ${fmtUSD(profit)}</div></div>
    ${printScript}</body></html>`;
}
