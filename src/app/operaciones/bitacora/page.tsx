"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Pencil,
  BarChart3,
  Package,
  DollarSign,
  Zap,
  X,
  Download,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Footer } from "@/components/layout/Footer";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { useGemini } from "@/hooks/useGemini";
import { useSafeQuery } from "@/hooks/useConvex";
import { api } from "../../../../convex/_generated/api";
import { exportToExcel } from "@/lib/export/excel";

/* ── Types ────────────────────────────────────────────────── */
type TabId = "design" | "ops" | "inventory" | "finance";

interface DesignRecord {
  fecha: string;
  org: string;
  flow: string;
  opt: string;
  cost: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
}

interface OpsRecord {
  fecha: string;
  op: string;
  flow: number;
  vol: number;
  phct: string;
  chem: string;
  compliance: number;
  obs: string;
}

interface InventoryRecord {
  fecha: string;
  item: string;
  consumed: string;
  auto: string;
  saldo: string;
}

interface FinanceRecord {
  mes: string;
  proy: number;
  real: number;
  comp: number;
  diff: number;
}

/* ── Tab config ───────────────────────────────────────────── */
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "design", label: "Diseño Técnico", icon: <Pencil className="w-5 h-5" /> },
  { id: "ops", label: "Operación Turnos", icon: <BarChart3 className="w-5 h-5" /> },
  { id: "inventory", label: "Control Insumos", icon: <Package className="w-5 h-5" /> },
  { id: "finance", label: "Reporte Financiero", icon: <DollarSign className="w-5 h-5" /> },
];

/* ── Helpers ──────────────────────────────────────────────── */
function formatDate(d: string) {
  if (!d) return "";
  if (d.includes("/")) return d;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function getMonthKey(dateStr: string): string {
  let date: Date;
  if (dateStr.includes("/")) {
    const [d, m, y] = dateStr.split("/");
    date = new Date(Number(y), Number(m) - 1, Number(d));
  } else {
    date = new Date(dateStr);
  }
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function getMonthKeyLong(dateStr: string): string {
  let date: Date;
  if (dateStr.includes("/")) {
    const [d, m, y] = dateStr.split("/");
    date = new Date(Number(y), Number(m) - 1, Number(d));
  } else {
    date = new Date(dateStr);
  }
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/* ── Chart helpers ──────────────────────────────────────── */
function SkeletonChart({ height = 180 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-xl animate-pulse"
      style={{ height, background: "rgba(255,255,255,0.04)" }}
    />
  );
}

function EmptyChart({ message, height = 180 }: { message: string; height?: number }) {
  return (
    <div
      className="w-full flex flex-col items-center justify-center gap-2 text-slate-600"
      style={{ height }}
    >
      <BarChart3 className="w-8 h-8 opacity-30" />
      <p className="text-[11px] font-bold uppercase tracking-widest text-center max-w-[220px]">
        {message}
      </p>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function BitacoraIntegralPage() {
  const { toast, showToast } = useToast();
  const { generate: generateAI, loading: aiLoading } = useGemini({ context: "bitacora-audit" });

  /* Tabs */
  const [activeTab, setActiveTab] = useState<TabId>("design");
  const [searchText, setSearchText] = useState("");

  /* AI Modal */
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiResponse, setAiResponse] = useState("");

  /* ── Pull Convex data ──────────────────────────────────── */
  const shiftRecords = useSafeQuery(api.shiftRecords.getAll);
  const inventoryItems = useSafeQuery(api.inventoryItems.getAll);
  const financialProjs = useSafeQuery(api.financialProjections.getAll);
  const jarSessions = useSafeQuery(api.jarTestSessions.getAll);

  // undefined = Convex still loading; [] = loaded but empty
  const isLoading =
    shiftRecords === undefined ||
    inventoryItems === undefined ||
    financialProjs === undefined ||
    jarSessions === undefined;

  /* ── Transform data ────────────────────────────────────── */
  const designHistory: DesignRecord[] = useMemo(() => {
    if (!jarSessions) return [];
    return jarSessions.map((s: NonNullable<typeof jarSessions>[number]) => ({
      fecha: formatDate(s.date),
      org: s.organizationName,
      flow: `${s.plantFlow}`,
      opt: `${s.rawWaterParams.length} params`,
      cost: s.opHours ? `${s.opHours}h` : "—",
      session: s,
    }));
  }, [jarSessions]);

  const opsHistory: OpsRecord[] = useMemo(() => {
    if (!shiftRecords) return [];
    return shiftRecords.map((r: NonNullable<typeof shiftRecords>[number]) => ({
      fecha: formatDate(r.date),
      op: r.operatorName,
      flow: r.stats.avgFlow,
      vol: r.stats.volumeTurno,
      phct: r.hourlyReadings.length > 0
        ? `${r.hourlyReadings[0].ph ?? "—"} / ${r.hourlyReadings[0].color ?? "—"} / ${r.hourlyReadings[0].turbiedad ?? "—"}`
        : "—",
      chem: r.dosificationEntries.map((d: NonNullable<typeof r.dosificationEntries>[number]) => d.product).join(", ") || "—",
      compliance: r.stats.compliancePercent,
      obs: r.notes || "",
    }));
  }, [shiftRecords]);

  const inventoryHistory: InventoryRecord[] = useMemo(() => {
    if (!inventoryItems) return [];
    return inventoryItems.map((i: NonNullable<typeof inventoryItems>[number]) => ({
      fecha: i.lastUpdated || "—",
      item: i.itemName,
      consumed: `${i.dailyConsumption} ${i.unit}/día`,
      auto: i.dailyConsumption > 0 ? `${Math.round(i.amount / i.dailyConsumption)} días` : "N/A",
      saldo: `${i.amount} ${i.unit}`,
    }));
  }, [inventoryItems]);

  const financeHistory: FinanceRecord[] = useMemo(() => {
    if (!financialProjs) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return financialProjs.map((f: any) => {
      const hasLinked = f.análisisProyectado !== undefined && f.análisisReal !== undefined;
      const proy = hasLinked
        ? (f.análisisProyectado as number)
        : f.mode === "projection"
        ? f.totals.grandTotal
        : 0;
      const real = hasLinked
        ? (f.análisisReal as number)
        : f.mode === "analysis"
        ? f.totals.grandTotal
        : 0;
      const comp = proy > 0 && real > 0 ? Math.round((real / proy) * 100) : proy > 0 ? 0 : 100;
      const diff = Math.round((real - proy) * 100) / 100;
      return {
        mes: `${f.institutionName || "Periodo"}${f.period ? ` (${f.period})` : ""}`,
        proy,
        real,
        comp,
        diff,
      };
    });
  }, [financialProjs]);

  /* ── Chart data ────────────────────────────────────────── */
  const monthlyProductionData = useMemo(() => {
    const sums: Record<string, number> = {};
    opsHistory.forEach((r) => {
      const key = getMonthKey(r.fecha);
      sums[key] = (sums[key] || 0) + (r.vol || 0);
    });
    return Object.entries(sums).map(([name, vol]) => ({ name, vol: Math.round(vol) }));
  }, [opsHistory]);

  const complianceData = useMemo(() => {
    if (opsHistory.length === 0) return [{ name: "Sin datos", value: 1, color: "#1e293b" }];
    const pass = opsHistory.filter((r) => r.compliance === 100).length;
    const fail = opsHistory.length - pass;
    return [
      { name: "Cumple", value: pass || 0, color: "#10b981" },
      { name: "Falla", value: fail || 0, color: "#ec4899" },
    ];
  }, [opsHistory]);

  const inventoryChartData = useMemo(() => {
    if (!inventoryItems) return [];
    return inventoryItems.map((i: NonNullable<typeof inventoryItems>[number]) => ({
      name: i.itemName.length > 8 ? i.itemName.slice(0, 8) + "…" : i.itemName,
      consumo: i.dailyConsumption * 30,
    }));
  }, [inventoryItems]);

  const financeChartData = useMemo(() => {
    return financeHistory.map((f) => ({
      name: f.mes.length > 12 ? f.mes.slice(0, 12) + "…" : f.mes,
      Proyectado: f.proy,
      Real: f.real,
    }));
  }, [financeHistory]);

  /* Monthly aggregation for ops */
  const monthlyOpsData = useMemo(() => {
    const data: Record<string, { records: number; sumFlow: number; sumVol: number }> = {};
    opsHistory.forEach((r) => {
      const key = getMonthKeyLong(r.fecha);
      if (!data[key]) data[key] = { records: 0, sumFlow: 0, sumVol: 0 };
      data[key].records += 1;
      data[key].sumFlow += r.flow || 0;
      data[key].sumVol += r.vol || 0;
    });
    return Object.entries(data).map(([month, d]) => ({
      month,
      records: d.records,
      avgFlow: d.records > 0 ? (d.sumFlow / d.records).toFixed(2) : "0",
      totalVol: Math.round(d.sumVol),
    }));
  }, [opsHistory]);

  /* ── Search filter ─────────────────────────────────────── */
  const q = searchText.toLowerCase();
  const filteredDesign = designHistory.filter((r) =>
    !q || `${r.fecha} ${r.org} ${r.flow}`.toLowerCase().includes(q)
  );
  const filteredOps = opsHistory.filter((r) =>
    !q || `${r.fecha} ${r.op} ${r.chem} ${r.obs}`.toLowerCase().includes(q)
  );
  const filteredInventory = inventoryHistory.filter((r) =>
    !q || `${r.fecha} ${r.item} ${r.saldo}`.toLowerCase().includes(q)
  );
  const filteredFinance = financeHistory.filter((r) =>
    !q || `${r.mes}`.toLowerCase().includes(q)
  );

  /* ── AI functions ──────────────────────────────────────── */
  async function runAudit(prompt: string) {
    setAiModalOpen(true);
    setAiResponse("Generando análisis avanzado...");
    const result = await generateAI(prompt);
    setAiResponse(result || "No se pudo generar una respuesta.");
  }

  function runGlobalAudit() {
    const summary = {
      diseños: designHistory.length,
      turnos: opsHistory.length,
      inventario: inventoryHistory.length,
      finanzas: financeHistory.length,
    };
    runAudit(
      `Analiza el estado general de la planta basado en estos registros: ${JSON.stringify(summary)}. Proporciona un resumen ejecutivo de la salud operativa.`
    );
  }

  function runOpsAI() {
    if (opsHistory.length === 0) return showToast("No hay registros de turno para analizar.", "error");
    runAudit(
      `Revisa estos registros de turno PTAP: ${JSON.stringify(opsHistory.slice(0, 20))}. Detecta patrones de incumplimiento y sugiere ajustes.`
    );
  }

  function runInventoryAI() {
    if (inventoryHistory.length === 0) return showToast("No hay datos de stock.", "error");
    runAudit(
      `Basado en el historial de inventario: ${JSON.stringify(inventoryHistory)}. Estima autonomía y recomienda compras.`
    );
  }

  function runFinanceAI() {
    if (financeHistory.length === 0) return showToast("No hay reportes financieros.", "error");
    runAudit(
      `Compara la proyección vs el gasto real: ${JSON.stringify(financeHistory.slice(0, 10))}. Analiza desviaciones.`
    );
  }

  function exportarExcel(tipo: string) {
    const dateStr = new Date().toISOString().slice(0, 10);
    switch (tipo) {
      case "Diseño":
        if (filteredDesign.length === 0) return showToast("No hay datos de diseño para exportar.", "error");
        exportToExcel(
          filteredDesign.map((r) => ({ Fecha: r.fecha, "Entidad / Planta": r.org, "Caudal Evaluado": r.flow, Optimización: r.opt, "Horas Op.": r.cost })),
          "Diseño Técnico",
          `Bitacora_Diseno_${dateStr}`
        );
        break;
      case "Operación":
        if (filteredOps.length === 0) return showToast("No hay registros de operación para exportar.", "error");
        exportToExcel(
          filteredOps.map((r) => ({ Fecha: r.fecha, Operador: r.op, "Caudal (L/s)": r.flow, "Volumen (m³)": r.vol, "pH/Color/Turb": r.phct, Químicos: r.chem, "% Cumplimiento": r.compliance, Observaciones: r.obs })),
          "Operación Turnos",
          `Bitacora_Operacion_${dateStr}`
        );
        break;
      case "Insumos":
        if (filteredInventory.length === 0) return showToast("No hay datos de insumos para exportar.", "error");
        exportToExcel(
          filteredInventory.map((r) => ({ Fecha: r.fecha, Producto: r.item, "Consumo Real": r.consumed, Autonomía: r.auto, "Saldo Bodega": r.saldo })),
          "Control Insumos",
          `Bitacora_Insumos_${dateStr}`
        );
        break;
      case "Finanzas":
        if (filteredFinance.length === 0) return showToast("No hay reportes financieros para exportar.", "error");
        exportToExcel(
          filteredFinance.map((r) => ({ Periodo: r.mes, "Proyectado (USD)": r.proy, "Real (USD)": r.real, "% Cumplimiento": r.comp, Diferencia: r.diff })),
          "Reporte Financiero",
          `Bitacora_Finanzas_${dateStr}`
        );
        break;
    }
    showToast(`Archivo Excel de ${tipo.toUpperCase()} descargado.`, "info");
  }

  function exportarPDF(tipo: string) {
    const dateStr = new Date().toLocaleDateString("es-EC");
    let rows = "";
    let headers = "";

    switch (tipo) {
      case "Diseño":
        headers = "<th>Fecha</th><th>Entidad</th><th>Caudal</th><th>Optimización</th><th>Horas</th>";
        rows = filteredDesign.map((r) => `<tr><td>${r.fecha}</td><td>${r.org}</td><td>${r.flow} L/s</td><td>${r.opt}</td><td>${r.cost}</td></tr>`).join("");
        break;
      case "Operación":
        headers = "<th>Fecha</th><th>Operador</th><th>Caudal</th><th>pH/Color/Turb</th><th>Químicos</th><th>%Cumpl.</th><th>Obs.</th>";
        rows = filteredOps.map((r) => `<tr><td>${r.fecha}</td><td>${r.op}</td><td>${r.flow}</td><td>${r.phct}</td><td>${r.chem}</td><td>${r.compliance}%</td><td>${r.obs}</td></tr>`).join("");
        break;
      case "Insumos":
        headers = "<th>Fecha</th><th>Producto</th><th>Consumo</th><th>Autonomía</th><th>Saldo</th>";
        rows = filteredInventory.map((r) => `<tr><td>${r.fecha}</td><td>${r.item}</td><td>${r.consumed}</td><td>${r.auto}</td><td>${r.saldo}</td></tr>`).join("");
        break;
      case "Finanzas":
        headers = "<th>Periodo</th><th>Proyectado</th><th>Real</th><th>% Cumpl.</th><th>Diferencia</th>";
        rows = filteredFinance.map((r) => `<tr><td>${r.mes}</td><td>$${r.proy.toLocaleString()}</td><td>$${r.real.toLocaleString()}</td><td>${r.comp}%</td><td>${r.diff}</td></tr>`).join("");
        break;
    }

    const html = `<html><head><title>Bitácora ${tipo} — TERAH2O</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#1e293b}h1{font-size:18px;margin-bottom:4px}p{font-size:12px;color:#64748b;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#0f172a;color:#fff;padding:8px;text-align:center}td{padding:8px;text-align:center;border-bottom:1px solid #e2e8f0}</style></head><body><h1>TERAH2O — Bitácora ${tipo}</h1><p>Fecha de emisión: ${dateStr}</p><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  function openDesignSessionPDF(r: DesignRecord) {
    const dateStr = new Date().toLocaleDateString("es-EC");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = r.session as any;
    const paramsRows = (s.rawWaterParams || [])
      .map((p: { label: string; value: number }) => `<tr><td>${p.label}</td><td>${p.value}</td></tr>`)
      .join("");
    const chemRows = (s.chemicals || [])
      .map((c: { name: string; func: string; concentration: number }) => `<tr><td>${c.name}</td><td>${c.func}</td><td>${c.concentration}%</td></tr>`)
      .join("");
    const html = `<html><head><title>Memoria Técnica — ${r.org}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#0a192f;font-size:11px}h1{font-size:18px;margin:0}h2{font-size:12px;background:#f1f5f9;padding:8px;border-left:4px solid #0ea5e9;margin:16px 0 8px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#0a192f;color:#fff;padding:8px;text-align:left}td{border:1px solid #e2e8f0;padding:8px}.footer{margin-top:30px;text-align:center;border-top:1px solid #eee;padding-top:12px;color:#64748b}</style></head><body>
      <h1>MEMORIA TÉCNICA — ${r.org}</h1><p style="color:#64748b">TeraH2O · Emitido: ${dateStr} · Fecha ensayo: ${r.fecha}</p>
      <h2>Datos de Planta</h2>
      <table><tr><th>Campo</th><th>Valor</th></tr><tr><td>Caudal</td><td>${r.flow} L/s</td></tr><tr><td>Horas Operación</td><td>${r.cost}</td></tr><tr><td>Punto de Muestreo</td><td>${s.samplePoint || "—"}</td></tr></table>
      <h2>Parámetros Agua Cruda</h2>
      <table><tr><th>Parámetro</th><th>Valor</th></tr>${paramsRows}</table>
      <h2>Insumos Técnicos</h2>
      <table><tr><th>Producto</th><th>Función</th><th>Concentración</th></tr>${chemRows}</table>
      ${s.aiDiagnosis ? `<h2>Diagnóstico IA</h2><p style="font-style:italic;color:#4c1d95;background:#f5f3ff;padding:10px;border-radius:6px">${s.aiDiagnosis}</p>` : ""}
      ${s.observations ? `<h2>Observaciones</h2><p>${s.observations}</p>` : ""}
      <div class="footer">TeraH2O — Documento válido digitalmente</div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  function openInventoryRowPDF(r: InventoryRecord) {
    const dateStr = new Date().toLocaleDateString("es-EC");
    const html = `<html><head><title>Informe Insumo — ${r.item}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#0a192f;font-size:12px}h1{font-size:18px}table{width:100%;border-collapse:collapse}th{background:#0a192f;color:#fff;padding:10px;text-align:left}td{border:1px solid #e2e8f0;padding:10px}.footer{margin-top:30px;text-align:center;border-top:1px solid #eee;padding-top:12px;color:#64748b}</style></head><body>
      <h1>Informe de Insumo — ${r.item}</h1><p style="color:#64748b">TeraH2O · Emitido: ${dateStr}</p>
      <table><tr><th>Campo</th><th>Valor</th></tr><tr><td>Fecha de registro</td><td>${r.fecha}</td></tr><tr><td>Producto</td><td>${r.item}</td></tr><tr><td>Consumo Real</td><td>${r.consumed}</td></tr><tr><td>Autonomía</td><td>${r.auto}</td></tr><tr><td>Saldo Bodega</td><td>${r.saldo}</td></tr></table>
      <div class="footer">TeraH2O — Documento válido digitalmente</div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  function openFinanceRowPDF(r: FinanceRecord) {
    const dateStr = new Date().toLocaleDateString("es-EC");
    const html = `<html><head><title>Informe Financiero — ${r.mes}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#0a192f;font-size:12px}h1{font-size:18px}table{width:100%;border-collapse:collapse}th{background:#0a192f;color:#fff;padding:10px;text-align:left}td{border:1px solid #e2e8f0;padding:10px}.notice{background:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:10px 14px;font-size:11px;color:#854d0e;margin-bottom:20px}.footer{margin-top:30px;text-align:center;border-top:1px solid #eee;padding-top:12px;color:#64748b}</style></head><body>
      <h1>Reporte Financiero — ${r.mes}</h1><p style="color:#64748b">TeraH2O · Emitido: ${dateStr}</p>
      <div class="notice">Registro guardado — Los valores reflejan el estado de la proyección al momento de su guardado. Para ver los datos actuales, consulte la sección Finanzas.</div>
      <table><tr><th>Campo</th><th>Valor</th></tr><tr><td>Período</td><td>${r.mes}</td></tr><tr><td>Proyectado (USD)</td><td>$${r.proy.toLocaleString()}</td></tr><tr><td>Real (USD)</td><td>$${r.real.toLocaleString()}</td></tr><tr><td>% Cumplimiento</td><td>${r.comp}%</td></tr><tr><td>Diferencia</td><td>${r.diff > 0 ? "+" : ""}${r.diff}</td></tr></table>
      <div class="footer">TeraH2O — Documento válido digitalmente</div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--navy-solid)", color: "#e2e8f0" }}>
      {/* AI Modal */}
      {aiModalOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-5"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
          onClick={() => setAiModalOpen(false)}
        >
          <div
            className="w-full max-w-[700px] rounded-3xl p-8 overflow-y-auto"
            style={{
              background: "#112240",
              border: "1px solid rgba(255,255,255,0.1)",
              maxHeight: "80vh",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                  <Zap className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black italic uppercase text-white">IA Insights</h2>
              </div>
              <button onClick={() => setAiModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="text-slate-300 leading-relaxed space-y-4 text-sm whitespace-pre-line">
              {aiLoading ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span>Procesando análisis avanzado...</span>
                </div>
              ) : (
                aiResponse
              )}
            </div>
            <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setAiModalOpen(false)}
                className="bg-white/5 hover:bg-white/10 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase transition-all"
              >
                Cerrar Auditoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className="sticky top-0 z-50 pt-6 pb-4 px-8"
        style={{
          background: "rgba(10, 10, 27, 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/operaciones"
              className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-sky-400" />
            </Link>
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 text-sky-400 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] mb-1 border border-sky-500/20">
                SISTEMA DE AUDITORÍA Y ARCHIVO INTEGRAL
              </div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                Bitácora <span className="text-sky-500">INTEGRAL</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NavbarUser />
            <button
              onClick={runGlobalAudit}
              className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                boxShadow: "0 4px 15px rgba(168, 85, 247, 0.3)",
              }}
            >
              <Zap className="w-4 h-4" />
              Global Audit
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-6 space-y-6 flex-1 w-full">
        {/* Tab Navigation */}
        <nav
          className="flex flex-wrap rounded-2xl overflow-hidden"
          style={{
            background: "#112240",
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                showToast(`Consola: ${tab.label.toUpperCase()}`, "info");
              }}
              className={`flex-1 flex flex-col items-center gap-2 py-4 px-3 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 ${
                activeTab === tab.id
                  ? "text-sky-400 border-sky-400 bg-sky-500/5"
                  : "text-slate-500 border-transparent hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar registros históricos..."
            className="w-full rounded-2xl py-3.5 pl-12 pr-6 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all"
            style={{
              background: "#112240",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
        </div>

        {/* ════════════════════════════════════════════════════
            SECTION 01: DISEÑO TÉCNICO
           ════════════════════════════════════════════════════ */}
        {activeTab === "design" && (
          <section className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-black uppercase text-white tracking-widest">
                Memorias de Tratabilidad y Optimización
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => exportarExcel("Diseño")} className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                  <Download className="w-4 h-4" /> Excel
                </button>
                <button onClick={() => exportarPDF("Diseño")} className="flex items-center gap-2 text-pink-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500/20 transition-all">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
              {filteredDesign.length === 0 ? (
                <div className="p-10 text-center text-slate-500 italic text-sm">
                  No hay informes de diseño archivados. Los registros se crean en la Consola Técnica.
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Fecha</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Entidad / Planta</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Caudal Evaluado</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Optimización</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Horas Op.</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDesign.map((r, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 text-[11px] text-center text-slate-400 font-mono">{r.fecha}</td>
                        <td className="p-3.5 text-[11px] text-center font-black text-white">{r.org}</td>
                        <td className="p-3.5 text-[11px] text-center font-bold text-sky-400">{r.flow} L/s</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-1 rounded text-[8px] font-black uppercase bg-sky-500/15 text-sky-400">{r.opt}</span>
                        </td>
                        <td className="p-3.5 text-[11px] text-center font-mono font-bold text-slate-300">{r.cost}</td>
                        <td className="p-3.5 text-center">
                          <button onClick={() => openDesignSessionPDF(r)} className="flex items-center gap-1 mx-auto text-pink-400 text-[9px] font-black px-3 py-1 rounded-lg border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500 hover:text-white transition-all">
                            <FileText className="w-3 h-3" /> PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════
            SECTION 02: OPERACIÓN TURNOS
           ════════════════════════════════════════════════════ */}
        {activeTab === "ops" && (
          <section className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-black uppercase text-white tracking-widest">Consola de Operación Real</h2>
                <button
                  onClick={runOpsAI}
                  className="flex items-center gap-2 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: "0 4px 15px rgba(168,85,247,0.3)" }}
                >
                  <Zap className="w-3.5 h-3.5" /> Diagnóstico Calidad
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportarExcel("Operación")} className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                  <Download className="w-4 h-4" /> Excel
                </button>
                <button onClick={() => exportarPDF("Operación")} className="flex items-center gap-2 text-pink-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500/20 transition-all">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl p-6" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
                <h4 className="text-[10px] font-black uppercase text-sky-400 mb-4 tracking-widest">Producción Real Mensual (m³/Mes)</h4>
                <div className="h-[180px]">
                  {isLoading ? (
                    <SkeletonChart height={180} />
                  ) : monthlyProductionData.length === 0 ? (
                    <EmptyChart height={180} message="Sin registros de producción. Crea turnos en la Hoja Operativa." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyProductionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                        <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: 11 }}
                        />
                        <Bar dataKey="vol" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <div className="rounded-2xl p-6" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
                <h4 className="text-[10px] font-black uppercase text-emerald-400 mb-4 tracking-widest">Cumplimiento de Calidad INEN</h4>
                <div className="h-[180px]">
                  {isLoading ? (
                    <SkeletonChart height={180} />
                  ) : complianceData.every(d => d.value === 0) ? (
                    <EmptyChart height={180} message="Sin parámetros registrados. Crea turnos en la Hoja Operativa." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={complianceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {complianceData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Legend
                          verticalAlign="bottom"
                          formatter={(value: string) => <span style={{ color: "#64748b", fontSize: 10 }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Production Table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="p-4 border-b border-white/5 bg-black/10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-sky-400">01. Historial de Producción Mensual Acumulada</h3>
              </div>
              {monthlyOpsData.length === 0 ? (
                <div className="p-10 text-center text-slate-500 italic text-sm">Sin datos mensuales registrados.</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Mes / Año</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Registros Turno</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Caudal Promedio (L/s)</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Volumen Acumulado (m³)</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyOpsData.map((d, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 text-[11px] text-center font-black text-white uppercase">{d.month}</td>
                        <td className="p-3.5 text-[11px] text-center text-slate-400">{d.records}</td>
                        <td className="p-3.5 text-[11px] text-center font-mono font-bold text-slate-300">{d.avgFlow}</td>
                        <td className="p-3.5 text-[11px] text-center font-black text-emerald-400">{d.totalVol.toLocaleString()} m³</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-1 rounded text-[8px] font-black uppercase bg-emerald-500/15 text-emerald-400">Cerrado</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Shift Detail Table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="p-4 border-b border-white/5 bg-black/10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">02. Registro Detallado de Turnos Operativos</h3>
              </div>
              {filteredOps.length === 0 ? (
                <div className="p-10 text-center text-slate-500 italic text-sm">No hay registros de turnos guardados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Fecha</th>
                        <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Operador</th>
                        <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Caudal</th>
                        <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">pH / Color / Turb</th>
                        <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Químicos</th>
                        <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">% Cumpl.</th>
                        <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Obs.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOps.map((r, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3.5 text-[10px] text-center font-mono text-slate-400">{r.fecha}</td>
                          <td className="p-3.5 text-[11px] text-center font-black text-white uppercase">{r.op}</td>
                          <td className="p-3.5 text-[11px] text-center font-bold text-sky-400">{r.flow}</td>
                          <td className="p-3.5 text-[10px] text-center text-slate-400">{r.phct}</td>
                          <td className="p-3.5 text-[11px] text-center font-mono text-emerald-400">{r.chem}</td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${r.compliance === 100 ? "bg-emerald-500/15 text-emerald-400" : "bg-sky-500/15 text-sky-400"}`}>
                              {r.compliance}%
                            </span>
                          </td>
                          <td className="p-3.5 text-[9px] text-center italic text-slate-500 max-w-[150px] truncate">{r.obs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════
            SECTION 03: CONTROL INSUMOS
           ════════════════════════════════════════════════════ */}
        {activeTab === "inventory" && (
          <section className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-black uppercase text-white tracking-widest">Kardex y Stock de Insumos</h2>
                <button
                  onClick={runInventoryAI}
                  className="flex items-center gap-2 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: "0 4px 15px rgba(168,85,247,0.3)" }}
                >
                  <Zap className="w-3.5 h-3.5" /> Predecir Stock
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportarExcel("Insumos")} className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                  <Download className="w-4 h-4" /> Excel
                </button>
                <button onClick={() => exportarPDF("Insumos")} className="flex items-center gap-2 text-pink-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500/20 transition-all">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl p-6" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h4 className="text-[10px] font-black uppercase text-amber-500 mb-4 tracking-widest">Consumo Global de Productos (kg/mes estimado)</h4>
              <div className="h-[250px]">
                {isLoading ? (
                  <SkeletonChart height={250} />
                ) : inventoryChartData.length === 0 ? (
                  <EmptyChart height={250} message="Sin insumos registrados. Añade productos en el módulo de Stock." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inventoryChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: 11 }}
                      />
                      <Bar dataKey="consumo" radius={[4, 4, 0, 0]}>
                        {inventoryChartData.map((_: (typeof inventoryChartData)[number], i: number) => (
                          <Cell key={i} fill={["#0ea5e9", "#ec4899", "#f59e0b", "#10b981"][i % 4]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="p-4 border-b border-white/5 bg-black/10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Informes de Inventario y Autonomía</h3>
              </div>
              {filteredInventory.length === 0 ? (
                <div className="p-10 text-center text-slate-500 italic text-sm">No hay informes de stock archivados.</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Fecha</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Producto</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Consumo Real</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Autonomía</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Saldo Bodega</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Documento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((r, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 text-[11px] text-center font-mono text-slate-400">{r.fecha}</td>
                        <td className="p-3.5 text-[11px] text-center font-black text-white">{r.item}</td>
                        <td className="p-3.5 text-[11px] text-center font-bold text-pink-500">{r.consumed}</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-1 rounded text-[8px] font-black uppercase bg-sky-500/15 text-sky-400">{r.auto}</span>
                        </td>
                        <td className="p-3.5 text-[11px] text-center font-black text-white">{r.saldo}</td>
                        <td className="p-3.5 text-center">
                          <button onClick={() => openInventoryRowPDF(r)} className="flex items-center gap-1 mx-auto text-pink-400 text-[9px] font-black px-3 py-1 rounded-lg border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500 hover:text-white transition-all">
                            <FileText className="w-3 h-3" /> PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════════
            SECTION 04: REPORTE FINANCIERO
           ════════════════════════════════════════════════════ */}
        {activeTab === "finance" && (
          <section className="space-y-6 fade-in">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-black uppercase text-white tracking-widest">Auditoría Financiera PTAP</h2>
                <button
                  onClick={runFinanceAI}
                  className="flex items-center gap-2 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase"
                  style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: "0 4px 15px rgba(168,85,247,0.3)" }}
                >
                  <Zap className="w-3.5 h-3.5" /> Auditoría Económica
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportarExcel("Finanzas")} className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                  <Download className="w-4 h-4" /> Excel
                </button>
                <button onClick={() => exportarPDF("Finanzas")} className="flex items-center gap-2 text-pink-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500/20 transition-all">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-2xl p-6" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h4 className="text-[10px] font-black uppercase text-pink-400 mb-4 tracking-widest">Comparativa Financiera: Proyectado vs Real (USD)</h4>
              <div className="h-[250px]">
                {isLoading ? (
                  <SkeletonChart height={250} />
                ) : financeChartData.length === 0 ? (
                  <EmptyChart height={250} message="Sin proyecciones guardadas. Genera informes en el módulo de Finanzas." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: 11 }}
                      />
                      <Legend formatter={(value: string) => <span style={{ color: "#94a3b8", fontSize: 10 }}>{value}</span>} />
                      <Bar dataKey="Proyectado" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Real" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="p-4 border-b border-white/5 bg-black/10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Informes de Análisis de Cumplimiento Económico</h3>
              </div>
              {filteredFinance.length === 0 ? (
                <div className="p-10 text-center text-slate-500 italic text-sm">No hay informes financieros registrados.</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Periodo</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Análisis Proyectado</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Análisis Real</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">% Cumplimiento</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Diferencia</th>
                      <th className="bg-black/20 p-3.5 text-[9px] font-black uppercase text-sky-400 text-center border-b border-white/10">Informes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFinance.map((r, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 text-[11px] text-center font-black text-white uppercase">{r.mes}</td>
                        <td className="p-3.5 text-[11px] text-center font-mono text-slate-400">$ {r.proy.toLocaleString()}</td>
                        <td className="p-3.5 text-[11px] text-center font-bold text-white">$ {r.real.toLocaleString()}</td>
                        <td className="p-3.5 text-[11px] text-center font-black text-emerald-400">{r.comp}%</td>
                        <td className={`p-3.5 text-[11px] text-center font-mono ${r.diff >= 0 ? "text-emerald-400" : "text-pink-500"}`}>
                          {r.diff > 0 ? "+" : ""}{r.diff}
                        </td>
                        <td className="p-3.5 text-center">
                          <button onClick={() => openFinanceRowPDF(r)} className="flex items-center gap-1 mx-auto text-pink-400 text-[9px] font-black px-3 py-1 rounded-lg border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500 hover:text-white transition-all">
                            <FileText className="w-3 h-3" /> PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </main>

      <Footer />
      <Toast {...toast} />
    </div>
  );
}
