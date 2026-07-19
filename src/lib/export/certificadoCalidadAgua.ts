// Generador del "Certificado de Ensayo de Calidad del Agua" en HTML,
// siguiendo el mismo patrón que memoriaFinanciera.ts: una función pura que
// construye el documento imprimible, abierto por la UI vía Blob + window.open
// (no window.print() sobre un div oculto). Incluye <meta charset="utf-8">
// para evitar mojibake de acentos/símbolos al abrir por Blob URL.

import { ALL, POINT_LABEL, evalParam, limText, normName, type Param, type SamplePoint } from "@/lib/calidad-agua/norma";

export interface CertificadoRow {
  param: Param;
  displayValue: string;
  limit: string;
  dictamen: "CUMPLE" | "NO CUMPLE" | "—";
}

export interface CertificadoData {
  code: string;
  point: SamplePoint;
  planta?: string;
  sector?: string;
  fecha?: string;
  hora?: string;
  analista?: string;
  responsable?: string;
  metodo?: string;
  calibracion?: string;
  certificado?: string;
  diagnostico?: string;
  results: Record<string, string>;
  pct: number;
  fail: number;
  /** Data URL (PNG) del QR de verificación, generado por el llamador con `qrcode`. */
  qrDataUrl?: string;
  /** URL de verificación mostrada como texto bajo el QR. */
  verifyUrl?: string;
}

function displayValue(p: Param, raw: string): string {
  if (p.type === "micro") return raw === "0" ? "Ausencia (<1.1)" : "Presencia (≥1.1)";
  if (p.type === "org") return raw === "0" ? "No objetable" : "Objetable";
  return raw;
}

export function buildCertificadoRows(data: CertificadoData): CertificadoRow[] {
  return ALL.filter((p) => data.results[p.k] != null && data.results[p.k] !== "").map((p) => {
    const raw = data.results[p.k];
    const st = evalParam(p, raw, data.point);
    return {
      param: p,
      displayValue: displayValue(p, raw),
      limit: limText(p, data.point),
      dictamen: st === "ok" ? "CUMPLE" : st === "bad" ? "NO CUMPLE" : "—",
    };
  });
}

export function buildCertificadoHTML(data: CertificadoData): string {
  const ok = data.fail === 0;
  const rows = buildCertificadoRows(data);

  const rowsHtml = rows
    .map((r) => {
      const col = r.dictamen === "CUMPLE" ? "#0e9f6e" : r.dictamen === "NO CUMPLE" ? "#dc2626" : "#64748b";
      return `<tr><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${r.param.n}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:center">${r.displayValue} ${r.param.u}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;text-align:center">${r.limit}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:800;color:${col}">${r.dictamen}</td></tr>`;
    })
    .join("");

  const dictamenGlobal = ok
    ? data.point === "CRUDA"
      ? "FUENTE APTA PARA TRATAMIENTO CONVENCIONAL"
      : "AGUA APTA PARA CONSUMO"
    : `NO CONFORME · ${data.fail} DESVIACIÓN(ES)`;

  return `<html><head><meta charset="utf-8"><title>Certificado de Ensayo - ${data.code}</title>
    <style>body{font-family:Inter,sans-serif;color:#0f172a;padding:40px;max-width:760px;margin:0 auto;font-size:11px}
    table{border-collapse:collapse}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #000040;padding-bottom:16px;margin-bottom:8px">
      <div><div style="font-size:9px;font-weight:800;letter-spacing:.2em;color:#64748b">TERAH2O · SISTEMA DE GESTIÓN DE CALIDAD</div>
      <div style="font-size:22px;font-weight:900;text-transform:uppercase;color:#000040;line-height:1.1;margin-top:6px">Reporte de Ensayo<br>de Calidad del Agua</div></div>
      <div style="text-align:right"><div style="font-size:9px;font-weight:800;color:#64748b;letter-spacing:.15em">${normName(data.point).toUpperCase()}</div><div style="font-family:monospace;font-weight:700;color:#000040;margin-top:4px">${data.code}</div></div>
    </div>
    <table style="width:100%;font-size:11px;margin:18px 0"><tr>
      <td style="padding:3px 0;width:50%"><b>Planta:</b> ${data.planta || "—"}</td><td><b>Punto:</b> ${POINT_LABEL[data.point]}</td></tr>
      <tr><td style="padding:3px 0"><b>Fecha / Hora:</b> ${data.fecha || "—"} ${data.hora || ""}</td><td><b>Sector:</b> ${data.sector || "—"}</td></tr>
      <tr><td style="padding:3px 0"><b>Analista:</b> ${data.analista || "—"}</td><td><b>Responsable calidad:</b> ${data.responsable || "—"}</td></tr>
      <tr><td style="padding:3px 0"><b>Método / Equipo:</b> ${data.metodo || "—"}</td><td><b>Calibración:</b> ${data.calibracion || "—"}</td></tr>
      <tr><td style="padding:3px 0"><b>Certificado de calibración:</b> ${data.certificado || "No aplica"}</td><td></td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#000040;color:#fff"><th style="padding:8px;text-align:left">Parámetro</th><th style="padding:8px">Resultado</th><th style="padding:8px">Límite norma</th><th style="padding:8px">Dictamen</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div style="margin-top:20px;padding:16px;border:2px solid ${ok ? "#0e9f6e" : "#dc2626"}">
      <span style="font-size:9px;font-weight:800;letter-spacing:.2em;color:#64748b">DICTAMEN GLOBAL</span>
      <div style="font-size:20px;font-weight:900;text-transform:uppercase;color:${ok ? "#0e9f6e" : "#dc2626"}">${dictamenGlobal} · ${data.pct}% CUMPLIMIENTO</div>
    </div>
    ${data.diagnostico ? `<div style="margin-top:16px;font-size:11px"><b>Diagnóstico técnico:</b><br>${data.diagnostico.replace(/\n/g, "<br>")}</div>` : ""}
    ${
      data.qrDataUrl
        ? `<div style="margin-top:28px;display:flex;align-items:center;gap:16px;padding:14px 16px;border:1px solid #cbd5e1;background:#f8fafc">
      <img src="${data.qrDataUrl}" style="width:96px;height:96px;flex:none" alt="QR verificación">
      <div>
        <div style="font-size:9px;font-weight:800;letter-spacing:.2em;color:#64748b">VERIFICACIÓN DE AUTENTICIDAD</div>
        <div style="font-size:13px;font-weight:800;color:#000040;margin:3px 0">Escanee el código QR para validar este certificado</div>
        <div style="font-size:10px;color:#64748b">El enlace muestra el ensayo original y confirma su estado <b>VERIFICADO</b> en la plataforma TERAH2O (requiere sesión iniciada).</div>
        <div style="font-family:monospace;font-size:10px;color:#000040;margin-top:4px">${data.code}</div>
      </div>
    </div>`
        : ""
    }
    <div style="margin-top:48px;display:flex;justify-content:space-between;font-size:10px">
      <div style="text-align:center;border-top:1px solid #0f172a;padding-top:6px;width:200px">${data.analista || "Analista de laboratorio"}</div>
      <div style="text-align:center;border-top:1px solid #0f172a;padding-top:6px;width:200px">${data.responsable || "Responsable de calidad"}</div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`;
}
