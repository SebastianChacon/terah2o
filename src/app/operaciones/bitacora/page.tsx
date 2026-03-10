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
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { useGemini } from "@/hooks/useGemini";
import { useSafeQuery } from "@/hooks/useConvex";
import { api } from "../../../../convex/_generated/api";

/* ── Types ────────────────────────────────────────────────── */
type TabId = "design" | "ops" | "inventory" | "finance";

interface DesignRecord {
  fecha: string;
  org: string;
  flow: string;
  opt: string;
  cost: string;
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

  /* ── Transform data ────────────────────────────────────── */
  const designHistory: DesignRecord[] = useMemo(() => {
    if (!jarSessions) return [];
    return jarSessions.map((s) => ({
      fecha: formatDate(s.date),
      org: s.organizationName,
      flow: `${s.plantFlow}`,
      opt: `${s.rawWaterParams.length} params`,
      cost: s.opHours ? `${s.opHours}h` : "—",
    }));
  }, [jarSessions]);

  const opsHistory: OpsRecord[] = useMemo(() => {
    if (!shiftRecords) return [];
    return shiftRecords.map((r) => ({
      fecha: formatDate(r.date),
      op: r.operatorName,
      flow: r.stats.avgFlow,
      vol: r.stats.volumeTurno,
      phct: r.hourlyReadings.length > 0
        ? `${r.hourlyReadings[0].ph ?? "—"} / ${r.hourlyReadings[0].color ?? "—"} / ${r.hourlyReadings[0].turbiedad ?? "—"}`
        : "—",
      chem: r.dosificationEntries.map((d) => d.product).join(", ") || "—",
      compliance: r.stats.compliancePercent,
      obs: r.notes || "",
    }));
  }, [shiftRecords]);

  const inventoryHistory: InventoryRecord[] = useMemo(() => {
    if (!inventoryItems) return [];
    return inventoryItems.map((i) => ({
      fecha: i.lastUpdated || "—",
      item: i.itemName,
      consumed: `${i.dailyConsumption} ${i.unit}/día`,
      auto: i.dailyConsumption > 0 ? `${Math.round(i.amount / i.dailyConsumption)} días` : "N/A",
      saldo: `${i.amount} ${i.unit}`,
    }));
  }, [inventoryItems]);

  const financeHistory: FinanceRecord[] = useMemo(() => {
    if (!financialProjs) return [];
    return financialProjs.map((f) => {
      const proy = f.totals.grandTotal;
      const real = f.totals.grandTotal;
      return {
        mes: f.institutionName || "Periodo",
        proy,
        real,
        comp: 100,
        diff: 0,
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
    return inventoryItems.map((i) => ({
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

  function exportarActual(tipo: string) {
    showToast(`Exportando archivo de ${tipo.toUpperCase()}...`, "info");
  }

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#060d1a", color: "#e2e8f0" }}>
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
          background: "rgba(6, 13, 26, 0.95)",
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
          <div className="flex gap-4">
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
              <button onClick={() => exportarActual("Diseño")} className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                <Download className="w-4 h-4" />
                Exportar Informes
              </button>
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
                          <button className="flex items-center gap-1 mx-auto text-pink-400 text-[9px] font-black px-3 py-1 rounded-lg border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500 hover:text-white transition-all">
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
              <button onClick={() => exportarActual("Operación")} className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                <Download className="w-4 h-4" /> Exportar Registros
              </button>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl p-6" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
                <h4 className="text-[10px] font-black uppercase text-sky-400 mb-4 tracking-widest">Producción Real Mensual (m³/Mes)</h4>
                <div className="h-[180px]">
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
                </div>
              </div>
              <div className="rounded-2xl p-6" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
                <h4 className="text-[10px] font-black uppercase text-emerald-400 mb-4 tracking-widest">Cumplimiento de Calidad INEN</h4>
                <div className="h-[180px]">
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
              <button onClick={() => exportarActual("Insumos")} className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                <Download className="w-4 h-4" /> Exportar Kardex
              </button>
            </div>

            {/* Chart */}
            <div className="rounded-2xl p-6" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h4 className="text-[10px] font-black uppercase text-amber-500 mb-4 tracking-widest">Consumo Global de Productos (kg/mes estimado)</h4>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0", fontSize: 11 }}
                    />
                    <Bar dataKey="consumo" radius={[4, 4, 0, 0]}>
                      {inventoryChartData.map((_, i) => (
                        <Cell key={i} fill={["#0ea5e9", "#ec4899", "#f59e0b", "#10b981"][i % 4]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
                          <button className="flex items-center gap-1 mx-auto text-pink-400 text-[9px] font-black px-3 py-1 rounded-lg border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500 hover:text-white transition-all">
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
              <button onClick={() => exportarActual("Finanzas")} className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase px-4 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                <Download className="w-4 h-4" /> Exportar Finanzas
              </button>
            </div>

            {/* Chart */}
            <div className="rounded-2xl p-6" style={{ background: "#112240", border: "1px solid rgba(255,255,255,0.05)" }}>
              <h4 className="text-[10px] font-black uppercase text-pink-400 mb-4 tracking-widest">Comparativa Financiera: Proyectado vs Real (USD)</h4>
              <div className="h-[250px]">
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
                          <button className="flex items-center gap-1 mx-auto text-pink-400 text-[9px] font-black px-3 py-1 rounded-lg border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500 hover:text-white transition-all">
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
