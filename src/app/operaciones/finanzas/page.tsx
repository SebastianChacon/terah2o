"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  Plus,
  X,
  FileText,
} from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { useGemini } from "@/hooks/useGemini";
import { AiButton } from "@/components/ai/AiButton";
import { InputField } from "@/components/ui/InputField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Footer } from "@/components/layout/Footer";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { HR_ROLES } from "@/lib/constants";
import { calculateMonthlyVolume, calculateBillableVolume } from "@/lib/calculations/hydraulic";
import {
  calculateChemicalMonthlyCost,
  calculateFinancialTotals,
  calculateBreakEvenRate,
  calculateRevenue,
} from "@/lib/calculations/financial";
import type {
  HRCost,
  OperationalExpenses,
  ChemicalCost,
  FinancialProjection,
} from "@/types/finance";
import { useSafeMutation, useSafeQuery } from "@/hooks/useConvex";
import { buildMemoriaFinancieraHTML } from "@/lib/export/memoriaFinanciera";
import { api } from "../../../../convex/_generated/api";

/* ── Types ─────────────────────────────────────────────────── */
type Mode = "projection" | "analysis";

interface ChemRow {
  id: number;
  name: string;
  dose: string;
  totalKg: string;
  pricePerKg: string;
}

/* ── Page ──────────────────────────────────────────────────── */
export default function FinanzasPage() {
  const { toast, showToast } = useToast();

  /* Mode toggle */
  const [mode, setMode] = useState<Mode>("projection");

  /* S00 — Institutional */
  const [instName, setInstName] = useState("");

  /* S01 — Production */
  const [plantFlow, setPlantFlow] = useState("");
  const [opHours, setOpHours] = useState("");
  const [realM3, setRealM3] = useState("");

  const volumeMonth = useMemo(() => {
    if (mode === "projection") {
      return calculateMonthlyVolume(parseFloat(plantFlow) || 0, parseFloat(opHours) || 0);
    }
    return parseFloat(realM3) || 0;
  }, [mode, plantFlow, opHours, realM3]);

  /* S02 — HR */
  const [hrRows, setHrRows] = useState<HRCost[]>(
    HR_ROLES.map((r) => ({ role: r.role, quantity: r.defaultQty, salary: r.defaultSalary, subtotal: r.defaultQty * r.defaultSalary }))
  );
  const updateHR = (idx: number, field: "quantity" | "salary", val: string) => {
    setHrRows((prev) => {
      const next = [...prev];
      const n = parseFloat(val) || 0;
      next[idx] = { ...next[idx], [field]: n, subtotal: field === "quantity" ? n * next[idx].salary : next[idx].quantity * n };
      return next;
    });
  };

  /* S03 — Expenses */
  const [expenses, setExpenses] = useState<OperationalExpenses>({ energy: 0, internet: 0, pettyCash: 0, maintenance: 0 });
  const updateExp = (field: keyof OperationalExpenses, val: string) =>
    setExpenses((prev) => ({ ...prev, [field]: parseFloat(val) || 0 }));

  /* S04 — Chemicals */
  const [chemRows, setChemRows] = useState<ChemRow[]>([
    { id: 1, name: "Coagulante (PAC)", dose: "", totalKg: "", pricePerKg: "" },
    { id: 2, name: "Cloro (Hipoclorito)", dose: "", totalKg: "", pricePerKg: "" },
  ]);
  const addChem = () =>
    setChemRows((r) => [...r, { id: Date.now(), name: "Nuevo Insumo", dose: "", totalKg: "", pricePerKg: "" }]);
  const removeChem = (id: number) => setChemRows((r) => r.filter((c) => c.id !== id));
  const updateChem = (id: number, field: keyof ChemRow, val: string) =>
    setChemRows((r) => r.map((c) => (c.id === id ? { ...c, [field]: val } : c)));

  /* Computed chemicals */
  const chemicals: ChemicalCost[] = useMemo(() => {
    return chemRows.map((c) => {
      const pricePerKg = parseFloat(c.pricePerKg) || 0;
      const dose = parseFloat(c.dose) || undefined;
      const totalKg = parseFloat(c.totalKg) || undefined;
      const monthlyCost = calculateChemicalMonthlyCost(
        mode, pricePerKg, dose,
        parseFloat(plantFlow) || 0, parseFloat(opHours) || 0, totalKg
      );
      return { name: c.name, dose, totalKg, pricePerKg, monthlyCost };
    });
  }, [chemRows, mode, plantFlow, opHours]);

  /* S05 — Sustainability */
  const [lossPercent, setLossPercent] = useState("");
  const [userRate, setUserRate] = useState("");

  const billableVolume = useMemo(
    () => calculateBillableVolume(volumeMonth, parseFloat(lossPercent) || 0),
    [volumeMonth, lossPercent]
  );

  /* Computed totals */
  const totals = useMemo(
    () => calculateFinancialTotals(hrRows, expenses, chemicals, volumeMonth),
    [hrRows, expenses, chemicals, volumeMonth]
  );
  const breakEvenRate = useMemo(
    () => calculateBreakEvenRate(totals.grandTotal, billableVolume),
    [totals.grandTotal, billableVolume]
  );
  const { revenue, profit } = useMemo(
    () => calculateRevenue(billableVolume, parseFloat(userRate) || 0, totals.grandTotal),
    [billableVolume, userRate, totals.grandTotal]
  );

  /* S07 — IA */
  const historicalData = useSafeQuery(api.financialProjections.getAll);
  const { generate: genOpt, loading: loadOpt } = useGemini({ context: "financial-optimization" });
  const { generate: genStrat, loading: loadStrat } = useGemini({ context: "financial-strategy" });
  const { generate: genSum, loading: loadSum } = useGemini({ context: "financial-summary" });
  const [aiResponse, setAiResponse] = useState("");

  const buildAiPrompt = useCallback(() => {
    const current = `Datos PTAP (${mode}): Institución: ${instName}, Volumen/Mes: ${volumeMonth.toFixed(0)} m³, Gasto Total: $${totals.grandTotal.toFixed(2)}, Costo/m³: $${totals.costPerM3.toFixed(4)}, RRHH: $${totals.totalLabor}, Químicos: $${totals.totalChemicals}, Margen: $${profit.toFixed(2)}, Tarifa: $${userRate || 0}/m³, Equilibrio: $${breakEvenRate.toFixed(4)}/m³`;

    if (!historicalData || historicalData.length === 0) return current;

    const relevant = historicalData
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.institutionName === instName)
      .slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => {
        const ra = r;
        const linked = ra.analisisReal !== undefined
          ? ` | Real: $${ra.analisisReal?.toFixed(2)} | Cumpl.: ${ra.cumplimiento?.toFixed(1)}%`
          : "";
        return `  - [${r.period ?? r.mode}] Total: $${r.totals.grandTotal.toFixed(2)} | Costo/m³: $${r.totals.costPerM3.toFixed(4)}${linked}`;
      })
      .join("\n");

    if (!relevant) return current;

    return `${current}\n\nHistorial previo de ${instName}:\n${relevant}\n\nUsa el historial para identificar tendencias, variaciones y oportunidades de optimización.`;
  }, [mode, instName, volumeMonth, totals, profit, userRate, breakEvenRate, historicalData]);

  const handleAi = useCallback(
    async (type: "opt" | "strat" | "sum") => {
      const prompt = buildAiPrompt();
      const gen = type === "opt" ? genOpt : type === "strat" ? genStrat : genSum;
      const result = await gen(prompt);
      if (result) setAiResponse(result);
    },
    [buildAiPrompt, genOpt, genStrat, genSum]
  );

  /* Save + PDF */
  const createProjection = useSafeMutation(api.financialProjections.create);
  const linkRealAnalysis = useSafeMutation(api.financialProjections.linkRealAnalysis);
  const createBitacora = useSafeMutation(api.bitacoraEntries.create);

  const resetForm = useCallback(() => {
    setInstName("");
    setPlantFlow("");
    setOpHours("");
    setRealM3("");
    setHrRows(
      HR_ROLES.map((r) => ({ role: r.role, quantity: r.defaultQty, salary: r.defaultSalary, subtotal: r.defaultQty * r.defaultSalary }))
    );
    setExpenses({ energy: 0, internet: 0, pettyCash: 0, maintenance: 0 });
    setChemRows([
      { id: 1, name: "Coagulante (PAC)", dose: "", totalKg: "", pricePerKg: "" },
      { id: 2, name: "Cloro (Hipoclorito)", dose: "", totalKg: "", pricePerKg: "" },
    ]);
    setLossPercent("");
    setUserRate("");
    setAiResponse("");
  }, []);

  const doSave = useCallback(async () => {
    if (!instName.trim()) return showToast("Nombre de institución requerido", "error");

    // Snapshot all display-critical values synchronously before any async operation.
    // After awaits, React 18 may flush batched state updates (e.g., from resetForm()),
    // which could cause the PDF to read post-reset defaults instead of the user's data.
    const snap = {
      instName,
      mode,
      plantFlow,
      opHours,
      realM3,
      volumeMonth,
      hrRows: hrRows.map((h) => ({ ...h })),
      expenses: { ...expenses },
      chemicals: chemicals.map((c) => ({ ...c })),
      lossPercent,
      billableVolume,
      userRate,
      breakEvenRate,
      revenue,
      profit,
      totals: { ...totals },
      aiResponse,
    };

    const period = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const projection: Omit<FinancialProjection, "_id"> = {
      institutionName: snap.instName,
      mode: snap.mode,
      production: {
        plantFlow: parseFloat(snap.plantFlow) || undefined,
        opHours: parseFloat(snap.opHours) || undefined,
        realM3: parseFloat(snap.realM3) || undefined,
        volumeMonth: snap.volumeMonth,
      },
      humanResources: snap.hrRows,
      operationalExpenses: snap.expenses,
      chemicals: snap.chemicals,
      sustainability: {
        lossPercent: parseFloat(snap.lossPercent) || 0,
        billableVolume: snap.billableVolume,
        userRate: parseFloat(snap.userRate) || 0,
        breakEvenRate: snap.breakEvenRate,
        revenue: snap.revenue,
        profit: snap.profit,
      },
      totals: snap.totals,
    };

    try {
      await createProjection({ ...projection, period });
      if (snap.mode === "analysis") {
        await linkRealAnalysis({
          institutionName: snap.instName,
          period,
          analysisGrandTotal: snap.totals.grandTotal,
        });
      }
      await createBitacora({
        date: new Date().toISOString().split("T")[0],
        source: "Finanzas PTAP",
        category: "Finanzas",
        summary: `${snap.mode === "projection" ? "Proyección" : "Análisis Real"} — ${snap.instName} — Total: $${snap.totals.grandTotal.toFixed(2)} — Costo/m³: $${snap.totals.costPerM3.toFixed(4)}`,
      });
      showToast("Informe guardado", "success");
      resetForm();
    } catch {
      showToast("Error al guardar informe", "error");
    }

    /* PDF — usa snap + el builder compartido para garantizar paridad exacta
       con la Bitácora (misma fuente de verdad: memoriaFinanciera.ts). */
    const html = buildMemoriaFinancieraHTML({
      instName: snap.instName,
      mode: snap.mode,
      dateLabel: new Date().toLocaleDateString(),
      volumeMonth: snap.volumeMonth,
      billableVolume: snap.billableVolume,
      costPerM3: snap.totals.costPerM3,
      hrRows: snap.hrRows,
      expenses: snap.expenses,
      chemicals: snap.chemicals,
      totalChemicals: snap.totals.totalChemicals,
      totalLabor: snap.totals.totalLabor,
      grandTotal: snap.totals.grandTotal,
      userRate: parseFloat(snap.userRate) || 0,
      breakEvenRate: snap.breakEvenRate,
      revenue: snap.revenue,
      profit: snap.profit,
      aiResponse: snap.aiResponse || undefined,
      autoPrint: true,
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (w) {
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } else {
      showToast("No se pudo abrir el informe en una nueva pestana.", "error");
    }
  }, [instName, mode, plantFlow, opHours, realM3, volumeMonth, hrRows, expenses, chemicals, lossPercent, billableVolume, userRate, breakEvenRate, revenue, profit, totals, aiResponse, createProjection, linkRealAnalysis, createBitacora, showToast, resetForm]);

  /* Informes ya generados HOY (mismo día calendario). _creationTime = ms epoch
     auto-asignado por Convex. Solo hoy — no días anteriores. */
  const [showTodayModal, setShowTodayModal] = useState(false);
  const todaysReports = useMemo<
    { id: string; title: string; grandTotal: number; time: string }[]
  >(() => {
    if (!historicalData) return [];
    const today = new Date().toDateString();
    return historicalData
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => new Date(r._creationTime).toDateString() === today)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        id: r._id as string,
        title: `${r.mode === "projection" ? "Proyeccion" : "Analisis Real"} — ${r.institutionName}`,
        grandTotal: (r.totals?.grandTotal ?? 0) as number,
        time: new Date(r._creationTime).toLocaleTimeString("es-EC", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
  }, [historicalData]);

  /* Click en "Generar Informe": si ya hay informes hoy, confirmar primero. */
  const handleGenerateClick = useCallback(() => {
    if (!instName.trim()) return showToast("Nombre de institución requerido", "error");
    if (todaysReports.length > 0) {
      setShowTodayModal(true);
      return;
    }
    doSave();
  }, [instName, todaysReports, doSave, showToast]);

  /* Format currency */
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AuthGuard permissionKey={["canAccessOperaciones", "canAccessFinanzas"]} moduleName="Finanzas">
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-navy-deep text-white shadow-2xl border-b-4 border-amber-500 sticky top-0 z-50">
        <div className="py-4 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/operaciones"
                className="p-2.5 bg-white/10 rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-amber-400" />
              </Link>
              <div className="bg-white/10 p-2 rounded-lg">
                <DollarSign className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl font-black italic uppercase tracking-tight">
                  Gestión Económica Integral PTAP
                </h1>
                <p className="text-sky-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">
                  Simulador de Proyecciones y Análisis Real Mensual
                </p>
              </div>
            </div>
            <NavbarUser />
          </div>
        </div>
        {/* Mode toggle */}
        <div className="bg-navy-light py-3 flex justify-center gap-3">
          <button
            onClick={() => setMode("projection")}
            className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all border ${
              mode === "projection"
                ? "bg-amber-500 text-navy-deep border-amber-500"
                : "text-white border-white/10 hover:border-white/30"
            }`}
          >
            Proyección Teórica
          </button>
          <button
            onClick={() => setMode("analysis")}
            className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase transition-all border ${
              mode === "analysis"
                ? "bg-amber-500 text-navy-deep border-amber-500"
                : "text-white border-white/10 hover:border-white/30"
            }`}
          >
            Análisis Real Mensual
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 pb-12">
        {/* S00+S01 — Institutional + Production */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <section className="bg-white rounded-2xl border-t-4 border-navy-deep p-6 shadow-md lg:col-span-2">
            <SectionHeader number="00" title="Datos Institucionales" />
            <InputField
              label="Nombre de la Institución / Planta"
              value={instName}
              onChange={(e) => setInstName(e.target.value)}
              placeholder="Ingrese nombre de la planta"
            />
          </section>

          <section className="bg-white rounded-2xl border-t-4 border-navy-deep p-6 shadow-md lg:col-span-2">
            <SectionHeader
              number="01"
              title={mode === "projection" ? "Producción Proyectada" : "Datos Reales de Producción"}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {mode === "projection" ? (
                <>
                  <InputField label="Caudal (L/s)" type="number" value={plantFlow} onChange={(e) => setPlantFlow(e.target.value)} placeholder="0.0" />
                  <InputField label="Horas Operación/Día" type="number" value={opHours} onChange={(e) => setOpHours(e.target.value)} placeholder="0" />
                </>
              ) : (
                <div className="col-span-2">
                  <span className="inline-block text-[8px] font-black text-sky-600 uppercase border border-sky-500 px-2 py-0.5 rounded mb-2">
                    Sincronizado con Hoja Operativa 🔄
                  </span>
                  <InputField label="Agua Tratada Total (m³)" type="number" value={realM3} onChange={(e) => setRealM3(e.target.value)} placeholder="0.0" />
                </div>
              )}
              <div className="bg-slate-100 p-3 rounded-lg text-center flex flex-col justify-center">
                <p className="text-[8px] font-black text-slate-500 uppercase">Volumen Mes Base</p>
                <p className="text-lg font-black text-navy-deep font-mono">
                  {volumeMonth.toLocaleString("en-US", { maximumFractionDigits: 2 })} m³
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* S02 — HR */}
        <section className="bg-white rounded-2xl border-t-4 border-navy-deep p-6 shadow-md">
          <SectionHeader number="02" title="Recurso Humano (Costo Fijo)" />
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr>
                  <th className="bg-slate-50 text-navy-deep p-3 font-black text-[10px] uppercase text-left">Cargo</th>
                  <th className="bg-slate-50 text-navy-deep p-3 font-black text-[10px] uppercase text-center">N° Personal</th>
                  <th className="bg-slate-50 text-navy-deep p-3 font-black text-[10px] uppercase text-center">Sueldo/Unit ($)</th>
                  <th className="bg-slate-50 text-navy-deep p-3 font-black text-[10px] uppercase text-center">Subtotal Mensual ($)</th>
                </tr>
              </thead>
              <tbody>
                {hrRows.map((h, i) => (
                  <tr key={h.role} className="border-b border-slate-100">
                    <td className="p-3 font-bold text-left">{h.role}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        className="w-20 mx-auto text-center font-bold border border-slate-200 rounded-lg p-2 block"
                        value={h.quantity}
                        onChange={(e) => updateHR(i, "quantity", e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        className="w-24 mx-auto text-center font-bold border border-slate-200 rounded-lg p-2 block"
                        value={h.salary}
                        onChange={(e) => updateHR(i, "salary", e.target.value)}
                      />
                    </td>
                    <td className="p-3 font-bold font-mono text-navy-deep text-center">
                      {fmt(h.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* S03 + S04 — Expenses + Chemicals */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <section className="bg-white rounded-2xl border-t-4 border-navy-deep p-6 shadow-md lg:col-span-1">
            <SectionHeader number="03" title="Gastos Operativos" />
            <div className="space-y-3">
              <InputField label="Energía Eléctrica ($)" type="number" value={expenses.energy || ""} onChange={(e) => updateExp("energy", e.target.value)} placeholder="0" />
              <InputField label="Internet / Conectividad ($)" type="number" value={expenses.internet || ""} onChange={(e) => updateExp("internet", e.target.value)} placeholder="0" />
              <InputField label="Gastos Caja Chica ($)" type="number" value={expenses.pettyCash || ""} onChange={(e) => updateExp("pettyCash", e.target.value)} placeholder="0" />
              <InputField label="Mantenimiento / Otros ($)" type="number" value={expenses.maintenance || ""} onChange={(e) => updateExp("maintenance", e.target.value)} placeholder="0" />
            </div>
          </section>

          <section className="bg-white rounded-2xl border-t-4 border-navy-deep p-6 shadow-md lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <SectionHeader
                number="04"
                title={mode === "projection" ? "Dosificación Teórica" : "Consumo Real y Stock"}
              />
              <button
                onClick={addChem}
                className="bg-amber-500 text-navy-deep text-[11px] font-black uppercase px-3 py-1.5 rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Añadir
              </button>
            </div>
            <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr>
                    <th className="bg-slate-50 text-navy-deep p-3 font-black text-[10px] uppercase text-left">Insumo</th>
                    <th className="bg-slate-50 text-navy-deep p-3 font-black text-[10px] uppercase text-center">
                      {mode === "projection" ? "Dosis (mg/L)" : "Kilos Usados"}
                    </th>
                    <th className="bg-slate-50 text-navy-deep p-3 font-black text-[10px] uppercase text-center">$/kg</th>
                    <th className="bg-slate-50 text-navy-deep p-3 font-black text-[10px] uppercase text-center">Gasto Mes ($)</th>
                    <th className="bg-slate-50 p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {chemRows.map((c, i) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full font-bold border border-slate-200 rounded-lg p-2 text-left"
                          value={c.name}
                          onChange={(e) => updateChem(c.id, "name", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.1"
                          className="w-24 mx-auto text-center font-bold border border-slate-200 rounded-lg p-2 block"
                          value={mode === "projection" ? c.dose : c.totalKg}
                          onChange={(e) =>
                            updateChem(c.id, mode === "projection" ? "dose" : "totalKg", e.target.value)
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 mx-auto text-center font-bold border border-slate-200 rounded-lg p-2 block"
                          value={c.pricePerKg}
                          onChange={(e) => updateChem(c.id, "pricePerKg", e.target.value)}
                        />
                      </td>
                      <td className="p-3 font-bold font-mono text-navy-deep text-center">
                        {fmt(chemicals[i]?.monthlyCost ?? 0)}
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => removeChem(c.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* S05 — Break-even */}
        <section className="bg-white rounded-2xl border-t-8 border-amber-500 p-6 shadow-md">
          <SectionHeader number="05" title="Punto de Equilibrio y Tarifas" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <InputField
                label="Pérdidas Técnicas/Comerciales (%)"
                type="number"
                value={lossPercent}
                onChange={(e) => setLossPercent(e.target.value)}
                placeholder="0"
              />
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-[9px] font-black text-blue-600 uppercase">Volumen Cobrable Proyectado</p>
                <p className="text-xl font-black text-navy-deep font-mono">
                  {billableVolume.toFixed(2)} m³
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <InputField
                label="Tarifa Actual / Sugerida ($/m³)"
                type="number"
                value={userRate}
                onChange={(e) => setUserRate(e.target.value)}
                placeholder="0.00"
                className="text-2xl text-emerald-600"
              />
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
                <p className="text-[9px] font-black text-amber-600 uppercase">Tarifa Equilibrio Crítica</p>
                <p className="text-xl font-black text-navy-deep font-mono">
                  ${breakEvenRate.toFixed(4)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="bg-emerald-600 text-white p-4 rounded-xl shadow-lg text-center">
                <p className="text-[9px] uppercase font-black opacity-80">Recaudación Proyectada</p>
                <p className="text-2xl font-black font-mono">{fmt(revenue)}</p>
              </div>
              <div className={`border-2 p-4 rounded-xl text-center ${profit >= 0 ? "border-emerald-500 bg-white" : "border-red-500 bg-red-50"}`}>
                <p className={`text-[9px] uppercase font-black ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  Margen Mensual Neto
                </p>
                <p className={`text-2xl font-black font-mono ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {fmt(profit)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* S06 — Summary */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl text-center shadow-sm">
            <p className="text-slate-500 text-[9px] uppercase font-black">Gasto en Químicos</p>
            <p className="text-xl font-black font-mono text-navy-deep">{fmt(totals.totalChemicals)}</p>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl text-center shadow-sm">
            <p className="text-slate-500 text-[9px] uppercase font-black">Gasto en Personal</p>
            <p className="text-xl font-black font-mono text-navy-deep">{fmt(totals.totalLabor)}</p>
          </div>
          <div className="bg-navy-deep text-white p-5 rounded-2xl text-center shadow-xl">
            <p className="text-sky-400 text-[9px] uppercase font-black">Presupuesto Total Operativo</p>
            <p className="text-2xl font-black font-mono">{fmt(totals.grandTotal)}</p>
          </div>
          <div className="bg-emerald-600 text-white p-5 rounded-2xl text-center shadow-xl">
            <p className="text-white text-[9px] uppercase font-black">Costo Real Unitario ($/m³)</p>
            <p className="text-3xl font-black font-mono">{totals.costPerM3.toFixed(4)}</p>
          </div>
        </section>

        {/* S07 — IA */}
        <section className="bg-white rounded-2xl border-t-8 border-violet-500 p-6 shadow-md">
          <SectionHeader number="07" title="Inteligencia Artificial Estratégica ✨" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <AiButton onClick={() => handleAi("opt")} loading={loadOpt} label="Optimización ✨" variant="blue" />
            <AiButton onClick={() => handleAi("strat")} loading={loadStrat} label="Estrategia ✨" variant="blue" />
            <AiButton onClick={() => handleAi("sum")} loading={loadSum} label="Resumen ✨" variant="amber" />
          </div>
          {aiResponse && (
            <div className="bg-violet-50 border border-violet-200 p-6 rounded-xl mt-4 fade-in">
              <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                {aiResponse}
              </div>
              <button
                onClick={() => setAiResponse("")}
                className="mt-4 text-[9px] font-bold text-slate-400 uppercase hover:text-slate-600"
              >
                Ocultar análisis
              </button>
            </div>
          )}
        </section>

        {/* Save + PDF */}
        <button
          onClick={handleGenerateClick}
          className="w-full bg-navy-deep hover:bg-blue-900 text-white py-5 rounded-xl font-black uppercase tracking-wider shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          <FileText className="w-6 h-6" />
          Generar Informe Gerencial PTAP (PDF)
        </button>
      </main>

      {/* Modal — informes ya generados hoy */}
      {showTodayModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-5"
          style={{ background: "rgba(10,16,30,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowTodayModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-navy-deep text-white px-6 py-4 flex items-center gap-3">
              <FileText className="w-6 h-6 text-amber-400" />
              <div>
                <h2 className="text-base font-black uppercase italic tracking-tight">
                  Informes generados hoy
                </h2>
                <p className="text-sky-400 text-[10px] font-bold uppercase tracking-widest">
                  {todaysReports.length} informe{todaysReports.length === 1 ? "" : "s"} en esta fecha
                </p>
              </div>
            </div>
            <div className="p-6 space-y-3 max-h-[50vh] overflow-y-auto">
              <p className="text-[12px] text-slate-500 mb-2">
                Ya registraste {todaysReports.length === 1 ? "un informe" : "informes"} hoy.
                Revisa el resumen antes de generar uno nuevo.
              </p>
              {todaysReports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 border border-slate-200 rounded-xl px-4 py-3 bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-navy-deep truncate">{r.title}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {r.time}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[8px] font-black text-slate-400 uppercase">Inversión Mensual</p>
                    <p className="text-base font-black font-mono text-emerald-600">{fmt(r.grandTotal)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowTodayModal(false)}
                className="px-5 py-2.5 rounded-xl text-[12px] font-black uppercase text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowTodayModal(false);
                  doSave();
                }}
                className="px-5 py-2.5 rounded-xl text-[12px] font-black uppercase text-white bg-navy-deep hover:bg-blue-900 transition-colors"
              >
                Continuar y generar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <Toast {...toast} />
    </div>
    </AuthGuard>
  );
}
