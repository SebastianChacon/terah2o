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
import { HR_ROLES } from "@/lib/constants";
import { calculateMonthlyVolume, calculateBillableVolume } from "@/lib/calculations/hydraulic";
import {
  calculateTotalHR,
  calculateTotalExpenses,
  calculateChemicalMonthlyCost,
  calculateTotalChemicals,
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
import { useSafeMutation } from "@/hooks/useConvex";
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
  const { generate: genOpt, loading: loadOpt } = useGemini({ context: "financial-optimization" });
  const { generate: genStrat, loading: loadStrat } = useGemini({ context: "financial-strategy" });
  const { generate: genSum, loading: loadSum } = useGemini({ context: "financial-summary" });
  const [aiResponse, setAiResponse] = useState("");

  const buildAiPrompt = useCallback(() => {
    return `Datos PTAP (${mode}): Institución: ${instName}, Volumen/Mes: ${volumeMonth.toFixed(0)} m³, Gasto Total: $${totals.grandTotal.toFixed(2)}, Costo/m³: $${totals.costPerM3.toFixed(4)}, RRHH: $${totals.totalLabor}, Químicos: $${totals.totalChemicals}, Margen: $${profit.toFixed(2)}, Tarifa: $${userRate || 0}/m³, Equilibrio: $${breakEvenRate.toFixed(4)}/m³`;
  }, [mode, instName, volumeMonth, totals, profit, userRate, breakEvenRate]);

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
  const createBitacora = useSafeMutation(api.bitacoraEntries.create);

  const handleSave = useCallback(async () => {
    if (!instName.trim()) return showToast("Nombre de institución requerido", "error");
    const projection: Omit<FinancialProjection, "_id"> = {
      institutionName: instName,
      mode,
      production: {
        plantFlow: parseFloat(plantFlow) || undefined,
        opHours: parseFloat(opHours) || undefined,
        realM3: parseFloat(realM3) || undefined,
        volumeMonth,
      },
      humanResources: hrRows,
      operationalExpenses: expenses,
      chemicals,
      sustainability: {
        lossPercent: parseFloat(lossPercent) || 0,
        billableVolume,
        userRate: parseFloat(userRate) || 0,
        breakEvenRate,
        revenue,
        profit,
      },
      totals,
    };

    try {
      await createProjection(projection);
      await createBitacora({
        date: new Date().toISOString().split("T")[0],
        source: "Finanzas PTAP",
        category: "Finanzas",
        summary: `Proyección ${mode} — ${instName} — Total: $${totals.grandTotal.toFixed(2)} — Costo/m³: $${totals.costPerM3.toFixed(4)}`,
      });
      showToast("Proyección guardada", "success");
    } catch {
      showToast("Error al guardar proyección", "error");
    }

    /* PDF */
    const w = window.open("", "_blank");
    if (w) {
      const chemRows2 = chemicals
        .map(
          (c) =>
            `<tr><td>${c.name}</td><td>${mode === "projection" ? (c.dose ?? 0) + " mg/L" : (c.totalKg ?? 0) + " kg"}</td><td>$${c.pricePerKg.toFixed(2)}</td><td>$${c.monthlyCost.toFixed(2)}</td></tr>`
        )
        .join("");
      w.document.write(`<html><head><title>Reporte PTAP - ${instName}</title>
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
        <p><b>Institución:</b> ${instName}</p><p><b>Fecha:</b> ${new Date().toLocaleDateString()}</p></div>
        <div style="background:#0a192f;color:white;padding:6px 12px;border-radius:6px;font-size:10px;text-transform:uppercase;font-weight:900;height:fit-content">MODO: ${mode.toUpperCase()}</div></div>
        <div class="grid">
          <div class="card"><b>Volumen Mes</b><span style="font-size:16px;font-weight:900">${volumeMonth.toFixed(0)} m³</span></div>
          <div class="card"><b>Vol. Facturable</b><span style="font-size:16px;font-weight:900">${billableVolume.toFixed(0)} m³</span></div>
          <div class="card"><b>Costo/m³</b><span style="font-size:16px;font-weight:900">$${totals.costPerM3.toFixed(4)}</span></div>
        </div>
        <h3>Recurso Humano</h3>
        <table><thead><tr><th>Cargo</th><th>N°</th><th>Unitario</th><th>Total</th></tr></thead><tbody>
        ${hrRows.map((h) => `<tr><td>${h.role}</td><td>${h.quantity}</td><td>$${h.salary}</td><td>$${h.subtotal.toFixed(2)}</td></tr>`).join("")}
        </tbody></table>
        <h3>Matriz Química</h3>
        <table><thead><tr><th>Nombre</th><th>Cantidad</th><th>Precio</th><th>Gasto</th></tr></thead><tbody>${chemRows2}</tbody></table>
        ${aiResponse ? `<div style="background:#fdfaff;border:1px solid #ddd6fe;border-radius:8px;padding:20px;margin-top:25px"><h4 style="margin-top:0;color:#8b5cf6;text-transform:uppercase;font-size:11px">ANÁLISIS IA</h4><div>${aiResponse.replace(/\n/g, "<br>")}</div></div>` : ""}
        <div class="footer"><p style="margin:0;font-size:11px;opacity:.8;font-weight:700;text-transform:uppercase">Inversión Mensual Total</p>
        <h2 style="font-size:42px;margin:10px 0">$${totals.grandTotal.toFixed(2)}</h2>
        <div style="display:inline-block;padding:8px 20px;border-radius:50px;background:${profit >= 0 ? "#10b981" : "#f43f5e"};font-weight:900;font-size:14px">
        MARGEN NETO: $${profit.toFixed(2)}</div></div>
        <script>window.onload=function(){window.print()}<\/script></body></html>`);
      w.document.close();
    }
  }, [instName, mode, plantFlow, opHours, realM3, volumeMonth, hrRows, expenses, chemicals, lossPercent, billableVolume, userRate, breakEvenRate, revenue, profit, totals, aiResponse, createProjection, createBitacora, showToast]);

  /* Format currency */
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
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
          onClick={handleSave}
          className="w-full bg-navy-deep hover:bg-blue-900 text-white py-5 rounded-xl font-black uppercase tracking-wider shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
        >
          <FileText className="w-6 h-6" />
          Generar Informe Gerencial PTAP (PDF)
        </button>
      </main>

      <Footer />
      <Toast {...toast} />
    </div>
  );
}
