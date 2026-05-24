"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  X,
  FileText,
  ClipboardCheck,
  User,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { useGemini } from "@/hooks/useGemini";
import { AiButton } from "@/components/ai/AiButton";
import { InputField } from "@/components/ui/InputField";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Footer } from "@/components/layout/Footer";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { CHEMICAL_PRODUCTS } from "@/types/chemical";
import {
  calculateDose,
  calculateDailyConsumption,
  calculateAutonomy,
} from "@/lib/calculations/dosification";
import type { HourlyReading, ShiftStats } from "@/types/shift";
import { TIME_SLOTS } from "@/types/shift";
import { useSafeMutation, useSafeQuery } from "@/hooks/useConvex";
import { api } from "../../../../convex/_generated/api";

/* ── Types ─────────────────────────────────────────────────── */
interface DosRow {
  id: number;
  product: string;
  mlMin: string;
  concentration: string;
}

type InvItem = {
  _id: string;
  itemId: string;
  itemName: string;
  amount: number;
};

/* ── Page ──────────────────────────────────────────────────── */
export default function HojaOperativaPage() {
  const { toast, showToast } = useToast();
  const { generate: generateAi, loading: aiLoading } = useGemini({
    context: "shift-expert",
  });

  /* S01 — Operador */
  const [operatorName, setOperatorName] = useState("");
  const today = new Date().toISOString().split("T")[0];

  /* Convex */
  const createShift = useSafeMutation(api.shiftRecords.create);
  const updateInventoryAmount = useSafeMutation(
    api.inventoryItems.updateAmount,
  );
  const inventoryItems = useSafeQuery(api.inventoryItems.getAll) as
    | InvItem[]
    | undefined;

  /* S02 — Dosificación */
  const [plantFlow, setPlantFlow] = useState("");
  const [opHours, setOpHours] = useState("8");
  const [dosRows, setDosRows] = useState<DosRow[]>([
    { id: 1, product: "PAC", mlMin: "", concentration: "10" },
  ]);

  /* Product options — dynamic from inventory, fallback to static list */
  const productOptions = useMemo(() => {
    if (inventoryItems && inventoryItems.length > 0) {
      return inventoryItems.map((i) => ({
        value: i.itemId,
        label: i.itemName,
      }));
    }
    return CHEMICAL_PRODUCTS;
  }, [inventoryItems]);

  const addDosRow = () =>
    setDosRows((r) => [
      ...r,
      {
        id: Date.now(),
        product: productOptions[0]?.value ?? "PAC",
        mlMin: "",
        concentration: "10",
      },
    ]);
  const removeDosRow = (id: number) =>
    setDosRows((r) => r.filter((x) => x.id !== id));
  const updateDosRow = (id: number, field: keyof DosRow, val: string) =>
    setDosRows((r) => r.map((x) => (x.id === id ? { ...x, [field]: val } : x)));

  /* Computed dose results — uses real inventory for autonomy (no mock data) */
  const doseResults = useMemo(() => {
    const flow = parseFloat(plantFlow) || 0;
    const hours = parseFloat(opHours) || 0;
    return dosRows.map((row) => {
      const ml = parseFloat(row.mlMin) || 0;
      const conc = parseFloat(row.concentration) || 0;
      const dose = calculateDose(ml, conc, flow);
      const dailyCons = calculateDailyConsumption(dose, flow, hours);
      const invItem = inventoryItems?.find((i) => i.itemId === row.product);
      const stock = invItem?.amount ?? 0;
      const autonomy =
        stock > 0 && dailyCons > 0 ? calculateAutonomy(stock, dailyCons) : null;
      return {
        id: row.id,
        dose: Math.round(dose * 100) / 100,
        autonomy: autonomy !== null ? Math.round(autonomy * 10) / 10 : null,
      };
    });
  }, [dosRows, plantFlow, opHours, inventoryItems]);

  /* S03 — Tabla Horaria */
  const [readings, setReadings] = useState<HourlyReading[]>(
    TIME_SLOTS.map((h): HourlyReading => ({ hora: h })),
  );

  const updateReading = (
    idx: number,
    field: keyof HourlyReading,
    val: string,
  ) => {
    setReadings((prev) => {
      const next = [...prev];
      const num = val === "" ? undefined : parseFloat(val);
      next[idx] = { ...next[idx], [field]: num };
      const r = next[idx];
      if (
        r.ph !== undefined ||
        r.cloro !== undefined ||
        r.color !== undefined ||
        r.turbiedad !== undefined
      ) {
        const phOk = r.ph === undefined || (r.ph >= 6.5 && r.ph <= 8.5);
        const cloroOk = r.cloro === undefined || r.cloro >= 0.3;
        const colorOk = r.color === undefined || r.color <= 15;
        const turbOk = r.turbiedad === undefined || r.turbiedad <= 5;
        const hasAny =
          r.ph !== undefined ||
          r.cloro !== undefined ||
          r.color !== undefined ||
          r.turbiedad !== undefined;
        next[idx].status = hasAny
          ? phOk && cloroOk && colorOk && turbOk
            ? "CUMPLE"
            : "CRÍTICO"
          : undefined;
      }
      return next;
    });
  };

  /* Stats */
  const stats: ShiftStats = useMemo(() => {
    const flows = readings
      .map((r) => r.caudal)
      .filter((v): v is number => v !== undefined && v > 0);
    const avgFlow =
      flows.length > 0 ? flows.reduce((a, b) => a + b, 0) / flows.length : 0;
    const hours = parseFloat(opHours) || 0;
    const volumeTurno = avgFlow * 3.6 * hours;
    const projection24h = avgFlow * 86.4;
    const evaluated = readings.filter((r) => r.status !== undefined);
    const okCount = evaluated.filter((r) => r.status === "CUMPLE").length;
    const compliancePercent =
      evaluated.length > 0 ? Math.round((okCount / evaluated.length) * 100) : 0;
    return {
      avgFlow: Math.round(avgFlow * 100) / 100,
      volumeTurno: Math.round(volumeTurno * 100) / 100,
      projection24h: Math.round(projection24h * 100) / 100,
      compliancePercent,
    };
  }, [readings, opHours]);

  /* Gauge data */
  const gaugeData = useMemo(() => {
    const evaluated = readings.filter((r) => r.status !== undefined);
    const okCount = evaluated.filter((r) => r.status === "CUMPLE").length;
    const total = evaluated.length;
    return [
      { name: "ok", value: okCount || 0 },
      { name: "fail", value: total > 0 ? total - okCount : 1 },
    ];
  }, [readings]);

  /* S04 — Novedades */
  const [notes, setNotes] = useState("");

  /* S05 — IA */
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  const handleAiConsult = useCallback(async () => {
    if (!aiQuery.trim())
      return showToast("Escriba la consulta técnica", "error");
    const result = await generateAi(aiQuery);
    if (result) setAiResponse(result);
  }, [aiQuery, generateAi, showToast]);

  /* S06 — Finalizar Turno */
  const handleFinalize = useCallback(async () => {
    if (!operatorName.trim())
      return showToast("Nombre del operador requerido", "error");

    const flow = parseFloat(plantFlow) || 0;
    const hours = parseFloat(opHours) || 8;

    // Strip explicit undefined values — Convex does not accept undefined in args
    const cleanReadings = readings.map((r): HourlyReading => {
      const obj: HourlyReading = { hora: r.hora };
      if (r.caudal !== undefined) obj.caudal = r.caudal;
      if (r.ph !== undefined) obj.ph = r.ph;
      if (r.cloro !== undefined) obj.cloro = r.cloro;
      if (r.color !== undefined) obj.color = r.color;
      if (r.turbiedad !== undefined) obj.turbiedad = r.turbiedad;
      if (r.rawPh !== undefined) obj.rawPh = r.rawPh;
      if (r.rawColor !== undefined) obj.rawColor = r.rawColor;
      if (r.rawTurbiedad !== undefined) obj.rawTurbiedad = r.rawTurbiedad;
      if (r.status !== undefined) obj.status = r.status;
      return obj;
    });

    const dosEntries = dosRows.map((row, i) => {
      const autonomy = doseResults[i]?.autonomy;
      return {
        product: row.product,
        mlMin: parseFloat(row.mlMin) || 0,
        concentration: parseFloat(row.concentration) || 0,
        doseResult: doseResults[i]?.dose || 0,
        ...(autonomy && autonomy > 0 ? { autonomyDays: autonomy } : {}),
      };
    });

    const shiftArgs = {
      operatorName,
      date: today,
      operationHours: hours,
      ...(flow > 0 ? { plantFlowRef: flow } : {}),
      hourlyReadings: cleanReadings,
      dosificationEntries: dosEntries,
      stats,
      ...(notes ? { notes } : {}),
      ...(aiResponse ? { aiConsultation: aiResponse } : {}),
    };

    try {
      await createShift(shiftArgs);

      // Auto-deduct daily consumption from inventory stock
      if (inventoryItems && inventoryItems.length > 0 && flow > 0) {
        for (const entry of dosEntries) {
          if (entry.doseResult <= 0) continue;
          const invItem = inventoryItems.find(
            (i) => i.itemId === entry.product,
          );
          if (!invItem) continue;
          const dailyCons = calculateDailyConsumption(
            entry.doseResult,
            flow,
            hours,
          );
          if (dailyCons <= 0) continue;
          const newAmount = Math.max(0, invItem.amount - dailyCons);
          try {
            await updateInventoryAmount({
              id: invItem._id as never,
              amount: Math.round(newAmount * 100) / 100,
              lastUpdated: new Date().toISOString(),
            });
          } catch (err) {
            console.error(`Stock deduction failed for ${entry.product}:`, err);
          }
        }
      }

      showToast("Turno archivado correctamente", "success");

      /* PDF report */
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`
          <html><head><title>Reporte Operativo PTAP - ${today}</title>
          <style>
            body{font-family:'Inter',sans-serif;padding:40px;color:#0a192f}
            h1{font-size:18px;text-transform:uppercase;border-bottom:3px solid #0a192f;padding-bottom:8px}
            h2{font-size:14px;margin-top:24px;color:#0ea5e9;text-transform:uppercase}
            table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
            th{background:#0a192f;color:white;padding:8px;text-transform:uppercase;font-size:10px}
            td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:center}
            .stat{display:inline-block;margin-right:30px;text-align:center}
            .stat-val{font-size:24px;font-weight:900}
            .stat-label{font-size:9px;text-transform:uppercase;color:#64748b}
            .ok{color:#16a34a;font-weight:900} .fail{color:#dc2626;font-weight:900}
          </style></head><body>
          <h1>Reporte Operativo PTAP — ${today}</h1>
          <p><strong>Operador:</strong> ${operatorName}</p>
          <h2>Estadísticas</h2>
          <div class="stat"><div class="stat-val">${stats.avgFlow} L/s</div><div class="stat-label">Caudal Promedio</div></div>
          <div class="stat"><div class="stat-val">${stats.volumeTurno} m³</div><div class="stat-label">Volumen Turno</div></div>
          <div class="stat"><div class="stat-val">${stats.projection24h} m³</div><div class="stat-label">Proyección 24h</div></div>
          <div class="stat"><div class="stat-val">${stats.compliancePercent}%</div><div class="stat-label">Cumplimiento</div></div>
          <h2>Monitoreo Horario — Barreras Sanitarias</h2>
          <table><thead><tr><th rowspan="2">Hora</th><th rowspan="2">Caudal</th><th colspan="3" style="background:#92400e;color:#fff">Agua Cruda</th><th colspan="4" style="background:#065f46;color:#fff">Agua Tratada</th><th rowspan="2">Estado</th></tr><tr><th>pH</th><th>Color</th><th>Turb.</th><th>pH</th><th>Cloro</th><th>Color</th><th>Turb.</th></tr></thead><tbody>
          ${readings.map((r) => `<tr><td>${r.hora}</td><td>${r.caudal ?? "-"}</td><td>${r.rawPh ?? "-"}</td><td>${r.rawColor ?? "-"}</td><td>${r.rawTurbiedad ?? "-"}</td><td>${r.ph ?? "-"}</td><td>${r.cloro ?? "-"}</td><td>${r.color ?? "-"}</td><td>${r.turbiedad ?? "-"}</td><td class="${r.status === "CUMPLE" ? "ok" : "fail"}">${r.status ?? "-"}</td></tr>`).join("")}
          </tbody></table>
          <h2>Dosificación</h2>
          <table><thead><tr><th>Producto</th><th>ml/min</th><th>Conc %</th><th>Dosis mg/L</th><th>Autonomía</th></tr></thead><tbody>
          ${dosRows.map((row, i) => `<tr><td>${row.product}</td><td>${row.mlMin}</td><td>${row.concentration}</td><td>${doseResults[i]?.dose}</td><td>${doseResults[i]?.autonomy !== null ? doseResults[i]?.autonomy + " días" : "--"}</td></tr>`).join("")}
          </tbody></table>
          ${notes ? `<h2>Novedades</h2><p>${notes}</p>` : ""}
          ${aiResponse ? `<h2>Consulta IA</h2><p>${aiResponse.replace(/\n/g, "<br>")}</p>` : ""}
          </body></html>
        `);
        w.document.close();
        w.print();
      }
    } catch (err) {
      console.error("Shift save error:", err);
      showToast("Error al guardar turno", "error");
    }
  }, [
    operatorName,
    today,
    opHours,
    plantFlow,
    readings,
    dosRows,
    doseResults,
    stats,
    notes,
    aiResponse,
    createShift,
    updateInventoryAmount,
    inventoryItems,
    showToast,
  ]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-navy-deep text-white py-6 px-6 shadow-2xl flex justify-between items-center border-b-4 border-sky-500 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            href="/operaciones"
            className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-sky-400" />
          </Link>
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tight">
              Hoja Operativa
            </h1>
            <p className="text-[10px] text-sky-400 font-bold uppercase tracking-widest">
              Control Técnico de Procesos
            </p>
          </div>
        </div>
        <NavbarUser />
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-6 space-y-6 pb-12">
        {/* S01 — Operador + Gauge */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border-t-[5px] border-navy-deep p-6 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-5 h-5 text-slate-400" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Operador Responsable del Turno
              </span>
            </div>
            <InputField
              label=""
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Nombre completo"
              className="text-lg py-4"
            />
            <p className="text-[10px] text-slate-400 mt-2 italic font-medium">
              Validación de cumplimiento bajo norma INEN 1108.
            </p>
          </div>

          <div className="bg-white rounded-2xl border-t-[5px] border-navy-deep p-6 shadow-md flex flex-col items-center justify-center">
            <div className="w-[140px] h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gaugeData}
                    innerRadius="78%"
                    outerRadius="100%"
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    <Cell fill="#0ea5e9" />
                    <Cell fill="#f1f5f9" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs font-black text-navy-deep mt-3 uppercase tracking-tighter">
              Cumplimiento: {stats.compliancePercent}%
            </p>
          </div>
        </section>

        {/* S02 — Dosificación */}
        <section className="bg-white rounded-2xl border-t-8 border-sky-500 p-6 shadow-md">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <SectionHeader number="02" title="Dosificación y Aforo Real" />
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex-1 min-w-[150px]">
                <InputField
                  label="Caudal Planta (L/s)"
                  type="number"
                  value={plantFlow}
                  onChange={(e) => setPlantFlow(e.target.value)}
                  placeholder="0.0"
                  className="text-center font-black text-xl border-sky-400"
                />
              </div>
              <div className="min-w-[120px]">
                <InputField
                  label="Horas Operación"
                  type="number"
                  value={opHours}
                  onChange={(e) => setOpHours(e.target.value)}
                  placeholder="8"
                  className="text-center font-black text-xl"
                />
              </div>
              <button
                onClick={addDosRow}
                className="mt-5 bg-sky-500 hover:bg-sky-600 text-white w-12 h-12 rounded-xl font-black text-2xl shadow-lg transition-all active:scale-90"
              >
                <Plus className="w-6 h-6 mx-auto" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dosRows.map((row, i) => {
              const res = doseResults[i];
              return (
                <div
                  key={row.id}
                  className="bg-slate-50 border border-slate-200 p-4 rounded-xl fade-in"
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-sky-500 rounded-full" />
                      <select
                        value={row.product}
                        onChange={(e) =>
                          updateDosRow(row.id, "product", e.target.value)
                        }
                        className="font-black text-navy-deep bg-transparent border-none p-0 focus:ring-0 focus:outline-none cursor-pointer text-sm"
                      >
                        {productOptions.map((p, index) => (
                          <option key={index} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {dosRows.length > 1 && (
                      <button
                        onClick={() => removeDosRow(row.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <InputField
                      label="Aforo (ml/min)"
                      type="number"
                      value={row.mlMin}
                      onChange={(e) =>
                        updateDosRow(row.id, "mlMin", e.target.value)
                      }
                      placeholder="0"
                      className="text-center"
                    />
                    <InputField
                      label="% Preparación"
                      type="number"
                      value={row.concentration}
                      onChange={(e) =>
                        updateDosRow(row.id, "concentration", e.target.value)
                      }
                      placeholder="10"
                      className="text-center"
                    />
                  </div>
                  <div className="bg-navy-deep text-white p-4 rounded-xl flex justify-between items-center shadow-lg border border-white/5 relative overflow-hidden">
                    <div className="absolute right-0 top-0 bottom-0 w-24 bg-sky-500/10 skew-x-[-20deg] translate-x-12 pointer-events-none" />
                    <div className="relative z-10">
                      <span className="text-[7px] uppercase block font-black text-sky-400 tracking-[0.2em] mb-1">
                        Dosis de Proceso
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-3xl tabular-nums">
                          {res?.dose.toFixed(2) ?? "0.00"}
                        </span>
                        <span className="text-[10px] font-bold opacity-60">
                          mg/L
                        </span>
                      </div>
                    </div>
                    <div className="relative z-10 text-right">
                      <span className="text-[7px] uppercase block font-black text-slate-400 tracking-[0.2em] mb-1">
                        Autonomía
                      </span>
                      <span className="font-black text-sm text-sky-200">
                        {res?.autonomy !== null && res?.autonomy
                          ? `${res.autonomy} días`
                          : "-- días"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* S03 — Stat Cards + Tabla Horaria */}
        <section className="bg-white rounded-2xl border-t-8 border-emerald-500 p-6 shadow-md">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border-b-4 border-sky-500 p-4 rounded-xl text-center shadow-sm">
              <span className="text-[9px] uppercase block font-black text-slate-400 mb-1">
                Caudal Promedio
              </span>
              <span className="font-black text-2xl text-navy-deep">
                {stats.avgFlow.toFixed(2)} L/s
              </span>
            </div>
            <div className="bg-white border-b-4 border-slate-300 p-4 rounded-xl text-center shadow-sm">
              <span className="text-[9px] uppercase block font-black text-slate-400 mb-1">
                Tiempo Operación
              </span>
              <span className="font-black text-2xl text-navy-deep">
                {opHours || "0"} hrs
              </span>
            </div>
            <div className="bg-white border-b-4 border-emerald-500 p-4 rounded-xl text-center shadow-sm">
              <span className="text-[9px] uppercase block font-black text-slate-400 mb-1">
                Volumen Turno
              </span>
              <span className="font-black text-2xl text-emerald-600">
                {stats.volumeTurno.toFixed(2)} m³
              </span>
            </div>
            <div className="bg-white border-b-4 border-sky-500 p-4 rounded-xl text-center shadow-sm">
              <span className="text-[9px] uppercase block font-black text-slate-400 mb-1">
                Proyección 24h
              </span>
              <span className="font-black text-2xl text-sky-600">
                {stats.projection24h.toFixed(0)} m³
              </span>
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[1000px] w-full text-[13px] border-collapse">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="bg-navy-deep text-white p-3 font-black text-[10px] uppercase"
                  >
                    Hora
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-navy-deep text-white p-3 font-black text-[10px] uppercase"
                  >
                    Caudal (L/s)
                  </th>
                  <th
                    colSpan={3}
                    className="bg-amber-700 text-white p-2 font-black text-[10px] uppercase text-center border-b border-white/10"
                  >
                    Agua Cruda
                  </th>
                  <th
                    colSpan={4}
                    className="bg-emerald-700 text-white p-2 font-black text-[10px] uppercase text-center border-b border-white/10"
                  >
                    Agua Tratada
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-navy-deep text-white p-3 font-black text-[10px] uppercase"
                  >
                    Estado
                  </th>
                </tr>
                <tr className="text-[9px] text-white">
                  <th className="bg-amber-800/80 p-2 font-bold">pH</th>
                  <th className="bg-amber-800/80 p-2 font-bold">Color</th>
                  <th className="bg-amber-800/80 p-2 font-bold">Turb.</th>
                  <th className="bg-emerald-800/80 p-2 font-bold">
                    pH (6.5-8.5)
                  </th>
                  <th className="bg-emerald-800/80 p-2 font-bold">
                    Cloro (≥0.3)
                  </th>
                  <th className="bg-emerald-800/80 p-2 font-bold">
                    Color (≤15)
                  </th>
                  <th className="bg-emerald-800/80 p-2 font-bold">
                    Turb. (≤5)
                  </th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r, idx) => (
                  <tr key={r.hora} className="hover:bg-slate-50">
                    <td className="font-black text-navy-deep bg-slate-50 border-r border-slate-200 p-3">
                      {r.hora}
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.1"
                        className="w-16 text-center text-xs font-bold border border-slate-200 rounded-lg p-2"
                        placeholder="0.0"
                        value={r.caudal ?? ""}
                        onChange={(e) =>
                          updateReading(idx, "caudal", e.target.value)
                        }
                      />
                    </td>
                    {/* Agua Cruda — sin columna Cloro (no aplicable en etapa de captación) */}
                    <td className="p-1 bg-amber-50/50">
                      <input
                        type="number"
                        step="0.1"
                        className="w-14 text-xs font-bold rounded-lg p-1.5 border border-amber-200 text-center bg-white"
                        placeholder="-"
                        value={r.rawPh ?? ""}
                        onChange={(e) =>
                          updateReading(idx, "rawPh", e.target.value)
                        }
                      />
                    </td>
                    <td className="p-1 bg-amber-50/50">
                      <input
                        type="number"
                        className="w-14 text-xs font-bold rounded-lg p-1.5 border border-amber-200 text-center bg-white"
                        placeholder="-"
                        value={r.rawColor ?? ""}
                        onChange={(e) =>
                          updateReading(idx, "rawColor", e.target.value)
                        }
                      />
                    </td>
                    <td className="p-1 bg-amber-50/50">
                      <input
                        type="number"
                        className="w-14 text-xs font-bold rounded-lg p-1.5 border border-amber-200 text-center bg-white"
                        placeholder="-"
                        value={r.rawTurbiedad ?? ""}
                        onChange={(e) =>
                          updateReading(idx, "rawTurbiedad", e.target.value)
                        }
                      />
                    </td>
                    {/* Agua Tratada */}
                    <td className="p-1 bg-emerald-50/50">
                      <input
                        type="number"
                        step="0.1"
                        className="w-14 text-xs font-black rounded-lg p-1.5 bg-navy-deep text-white border border-white/20 text-center"
                        placeholder="-"
                        value={r.ph ?? ""}
                        onChange={(e) =>
                          updateReading(idx, "ph", e.target.value)
                        }
                      />
                    </td>
                    <td className="p-1 bg-emerald-50/50">
                      <input
                        type="number"
                        step="0.1"
                        className="w-14 text-xs font-black rounded-lg p-1.5 bg-navy-deep text-white border border-white/20 text-center"
                        placeholder="-"
                        value={r.cloro ?? ""}
                        onChange={(e) =>
                          updateReading(idx, "cloro", e.target.value)
                        }
                      />
                    </td>
                    <td className="p-1 bg-emerald-50/50">
                      <input
                        type="number"
                        className="w-14 text-xs font-black rounded-lg p-1.5 bg-navy-deep text-white border border-white/20 text-center"
                        placeholder="-"
                        value={r.color ?? ""}
                        onChange={(e) =>
                          updateReading(idx, "color", e.target.value)
                        }
                      />
                    </td>
                    <td className="p-1 bg-emerald-50/50">
                      <input
                        type="number"
                        className="w-14 text-xs font-black rounded-lg p-1.5 bg-navy-deep text-white border border-white/20 text-center"
                        placeholder="-"
                        value={r.turbiedad ?? ""}
                        onChange={(e) =>
                          updateReading(idx, "turbiedad", e.target.value)
                        }
                      />
                    </td>
                    <td className="p-2 font-black text-[9px] uppercase text-center">
                      {r.status === "CUMPLE" ? (
                        <span className="bg-green-100 text-green-800 font-black rounded-md px-2 py-1 text-[10px]">
                          CUMPLE
                        </span>
                      ) : r.status === "CRÍTICO" ? (
                        <span className="bg-red-100 text-red-800 font-black rounded-md px-2 py-1 text-[10px]">
                          NO CUMPLE
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* S04 — Novedades */}
        <section className="bg-white rounded-2xl border-t-8 border-navy-deep p-6 shadow-md">
          <SectionHeader number="04" title="Registro de Novedades" />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Detalle eventos relevantes (limpieza, fallas, recepción de insumos...)"
            className="w-full p-4 rounded-xl font-bold border border-slate-200 bg-white text-slate-900 focus:border-navy-blue focus:outline-none focus:ring-4 focus:ring-navy-blue/[0.08] transition-all"
          />
        </section>

        {/* S05 — IA Experta */}
        <section className="bg-amber-50/30 rounded-2xl border-t-8 border-amber-500 p-6 shadow-md">
          <SectionHeader number="05" title="Asistente Experto IA" />
          <div className="space-y-4">
            <textarea
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              rows={2}
              placeholder="Describa la anomalía técnica para recibir asistencia experta..."
              className="w-full p-4 rounded-xl font-bold border border-slate-200 bg-white text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-400/[0.08] transition-all"
            />
            <AiButton
              onClick={handleAiConsult}
              loading={aiLoading}
              label="Solicitar Dictamen Técnico"
              loadingLabel="Consultando IA..."
              variant="amber"
            />
            {aiResponse && (
              <div className="bg-white border-2 border-sky-200 p-6 rounded-xl shadow-sm fade-in">
                <div className="flex items-center gap-2 mb-3 border-b border-sky-100 pb-2">
                  <span className="bg-sky-500 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                    Dictamen Técnico
                  </span>
                  <span className="text-[10px] font-bold text-sky-600 uppercase">
                    Tera IA Engine
                  </span>
                </div>
                <div
                  className="font-medium text-slate-700 text-sm leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: aiResponse
                      .replace(/\[ANÁLISIS\]/g, "<b>ANÁLISIS:</b>")
                      .replace(/\[ACCIÓN\]/g, "<br><br><b>ACCIÓN:</b>")
                      .replace(/\[CONTROL\]/g, "<br><br><b>CONTROL:</b>"),
                  }}
                />
              </div>
            )}
          </div>
        </section>

        {/* S06 — Finalizar Turno */}
        <section className="space-y-4">
          {stats.compliancePercent < 100 && stats.compliancePercent > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-xl text-amber-800 text-sm font-bold flex items-center gap-3 fade-in">
              <ClipboardCheck className="w-6 h-6 flex-shrink-0" />
              <span>
                ¡Alerta! Desviación detectada en barreras sanitarias. Revise
                dosificación.
              </span>
            </div>
          )}
          <button
            onClick={handleFinalize}
            className="w-full bg-navy-deep hover:bg-blue-900 text-white py-5 rounded-xl font-black uppercase tracking-wider shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <FileText className="w-6 h-6" />
            Finalizar Turno y Generar Reporte
          </button>
        </section>
      </main>

      <Footer />
      <Toast {...toast} />
    </div>
  );
}
