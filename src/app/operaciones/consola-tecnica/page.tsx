"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  X,
  Beaker,
  FlaskConical,
  Droplets,
  Calculator,
  FileText,
  Sparkles,
} from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { useGemini } from "@/hooks/useGemini";
import { Footer } from "@/components/layout/Footer";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useSafeMutation } from "@/hooks/useConvex";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "../../../../convex/_generated/api";

/* ── Types ─────────────────────────────────────────────────── */

type ChemFunc = "coag" | "ph" | "helper" | "oxid";

interface Chemical {
  id: number;
  name: string;
  func: ChemFunc;
  conc: number;
  price: number;
}

interface Jar {
  id: number;
  doses: Record<number, string>;
  turbF: string;
  colorF: string;
  phF: string;
}

interface ExtraParam {
  key: string;
  label: string;
  value: string;
}

const FUNC_LABELS: Record<ChemFunc, string> = {
  coag: "Coagulante",
  ph: "Reg. pH",
  helper: "Ayudante",
  oxid: "Oxidante",
};

const FUNC_COLORS: Record<ChemFunc, string> = {
  coag: "bg-sky-500",
  ph: "bg-red-500",
  helper: "bg-amber-500",
  oxid: "bg-emerald-500",
};

const FUNC_TEXT_COLORS: Record<ChemFunc, string> = {
  coag: "text-sky-400",
  ph: "text-red-400",
  helper: "text-amber-400",
  oxid: "text-emerald-400",
};

const DEFAULT_CHEMICALS: Chemical[] = [
  { id: 1, name: "SULFATO DE ALUMINIO 10%", func: "coag", conc: 10, price: 0.85 },
  { id: 2, name: "CAL HIDRATADA 5%", func: "ph", conc: 5, price: 0.32 },
  { id: 3, name: "POLIMERO ANIONICO 0.1%", func: "helper", conc: 0.1, price: 6.5 },
  { id: 4, name: "HIPOCLORITO CALCIO 6.5%", func: "oxid", conc: 6.5, price: 2.15 },
];

/* ── Helpers ───────────────────────────────────────────────── */

function n(v: string): number {
  return parseFloat(v) || 0;
}

function calcBaselineMgL(aforo: number, conc: number, flow: number): number {
  if (flow <= 0) return 0;
  return (aforo * conc * 10) / (flow * 60);
}

/* ── Component ─────────────────────────────────────────────── */

export default function ConsolaTecnicaPage() {
  const { toast, showToast } = useToast();
  const { generate: generateAI, loading: loadingAI } = useGemini({
    context: "raw-water-analysis",
  });
  const createJarTest = useSafeMutation(api.jarTestSessions.create);
  const createBitacora = useSafeMutation(api.bitacoraEntries.create);
  const { user } = useCurrentUser();

  // Plant config
  const [plantFlow, setPlantFlow] = useState("");
  const [opHours, setOpHours] = useState("24");

  // Chemicals
  const [chemicals, setChemicals] = useState<Chemical[]>(DEFAULT_CHEMICALS);
  const [newChemName, setNewChemName] = useState("");
  const [newChemFunc, setNewChemFunc] = useState<ChemFunc>("coag");
  const [newChemConc, setNewChemConc] = useState("10");

  // Baseline aforos
  const [baselineAforos, setBaselineAforos] = useState<Record<number, string>>({});

  // Raw water params
  const [simTurb, setSimTurb] = useState("0");
  const [simPh, setSimPh] = useState("7.0");
  const [simColor, setSimColor] = useState("0");
  const [simFe, setSimFe] = useState("0.00");
  const [extraParams, setExtraParams] = useState<ExtraParam[]>([]);
  const [newParamName, setNewParamName] = useState("");

  // AI diagnosis
  const [aiDiagnosis, setAiDiagnosis] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Simulation results
  const [showSimResults, setShowSimResults] = useState(false);

  // Jars
  const [jars, setJars] = useState<Jar[]>([
    { id: 1, doses: {}, turbF: "", colorF: "", phF: "" },
    { id: 2, doses: {}, turbF: "", colorF: "", phF: "" },
    { id: 3, doses: {}, turbF: "", colorF: "", phF: "" },
    { id: 4, doses: {}, turbF: "", colorF: "", phF: "" },
  ]);
  const [nextJarId, setNextJarId] = useState(5);

  // Validated jar doses
  const [validatedDoses, setValidatedDoses] = useState<Record<ChemFunc, number> | null>(null);
  const [bestJarId, setBestJarId] = useState<number | null>(null);

  // Chlorine calculator
  const [clApplied, setClApplied] = useState("0");
  const [clMeasured, setClMeasured] = useState("0");
  const [clTarget, setClTarget] = useState("1.0");

  // Report
  const [repoOrg, setRepoOrg] = useState("");
  const [repoSample, setRepoSample] = useState("");
  const [repoObs, setRepoObs] = useState("");

  /* ── Derived calculations ──────────────────────────────── */

  const flow = n(plantFlow);
  const hours = n(opHours);
  const dailyVolume = flow * 3.6 * hours;

  const hasBaseline = Object.values(baselineAforos).some((v) => n(v) > 0);

  // Simulation calculations
  const turb = n(simTurb);
  const ph = n(simPh);
  const col = n(simColor);
  const fe = n(simFe);

  let demCl = 1.2 + fe * 0.64 + col * 0.05;
  extraParams.forEach((p) => {
    if (p.key === "mn") demCl += n(p.value) * 1.3;
    if (p.key === "no2") demCl += n(p.value) * 1.5;
  });

  const dCoag = (turb < 10 ? 12 : turb < 50 ? 30 : 60) + col / 6;
  const dPh = ph < 7.1 ? (7.2 - ph) * 20 + dCoag * 0.2 : 0;
  const dHelper = turb > 40 ? 0.8 : 0.2;

  const chlorineDemand = Math.max(0, n(clApplied) - n(clMeasured));
  const chlorineOperativeDose = chlorineDemand + n(clTarget);

  const simDoses: Record<ChemFunc, number> = {
    coag: dCoag,
    ph: dPh,
    helper: dHelper,
    oxid: chlorineOperativeDose > 0 ? chlorineOperativeDose : demCl,
  };

  const activeDoses = validatedDoses
    ? { ...validatedDoses, oxid: chlorineOperativeDose > 0 ? chlorineOperativeDose : demCl }
    : simDoses;

  /* ── Finance calculations ──────────────────────────────── */

  const volMonth = dailyVolume * 30;

  const financeRows = chemicals.map((c) => {
    const dose = activeDoses[c.func] || 0;
    const mlm = c.conc > 0 ? (dose * flow * 60) / (c.conc * 10) : 0;
    const kgMonth = (dose * volMonth) / 1000;
    const cost = kgMonth * c.price;

    const baseAforo = n(baselineAforos[c.id] || "0");
    const baseDose = calcBaselineMgL(baseAforo, c.conc, flow);
    const baseCost = ((baseDose * volMonth) / 1000) * c.price;

    return { chemical: c, dose, mlm, kgMonth, cost, baseCost };
  });

  const totalOptCost = financeRows.reduce((s, r) => s + r.cost, 0);
  const totalBaseCost = financeRows.reduce((s, r) => s + r.baseCost, 0);
  const savings = hasBaseline ? totalBaseCost - totalOptCost : 0;
  const efficiency = totalBaseCost > 0 ? (savings / totalBaseCost) * 100 : 0;
  const costPerM3 = volMonth > 0 ? totalOptCost / volMonth : 0;

  /* ── Handlers ──────────────────────────────────────────── */

  const addChemical = () => {
    if (!newChemName.trim()) return;
    const id = Date.now();
    setChemicals((prev) => [
      ...prev,
      { id, name: newChemName.toUpperCase(), func: newChemFunc, conc: n(newChemConc), price: 1.0 },
    ]);
    setNewChemName("");
    showToast("Producto registrado", "success");
  };

  const removeChemical = (id: number) => {
    setChemicals((prev) => prev.filter((c) => c.id !== id));
    setBaselineAforos((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateBaselineAforo = (id: number, val: string) => {
    setBaselineAforos((prev) => ({ ...prev, [id]: val }));
  };

  const addExtraParam = () => {
    const label = newParamName.trim();
    if (!label) return;
    const key = `custom_${Date.now()}`;
    setExtraParams((prev) => [...prev, { key, label, value: "0" }]);
    setNewParamName("");
  };

  const removeExtraParam = (key: string) => {
    setExtraParams((prev) => prev.filter((p) => p.key !== key));
  };

  const updateExtraParam = (key: string, val: string) => {
    setExtraParams((prev) => prev.map((p) => (p.key === key ? { ...p, value: val } : p)));
  };

  const ejecutarSimulacion = () => {
    if (flow <= 0) {
      showToast("Ingrese el caudal de operacion", "error");
      return;
    }
    setShowSimResults(true);
    showToast("Simulacion calculada", "info");
  };

  const consultarIA = async () => {
    let paramsText = `Turbiedad: ${turb} NTU, pH: ${ph}, Color: ${col} UC, Fe: ${fe} mg/L. `;
    extraParams.forEach((p) => {
      paramsText += `${p.label}: ${n(p.value)}, `;
    });
    paramsText += `Caudal: ${flow} L/s, Horas operacion: ${hours}h.`;

    setShowAiPanel(true);
    setAiDiagnosis("IA analizando parametros...");

    const prompt = `Analiza estos datos de agua cruda: ${paramsText}. Recomienda estrategia de dosificacion para garantizar potabilidad bajo INEN 1108. Maximo 5 lineas.`;
    const result = await generateAI(prompt);
    setAiDiagnosis(result || "No se pudo obtener respuesta de la IA.");
  };

  // Jars
  const addJar = () => {
    setJars((prev) => [...prev, { id: nextJarId, doses: {}, turbF: "", colorF: "", phF: "" }]);
    setNextJarId((prev) => prev + 1);
  };

  const removeJar = (id: number) => {
    setJars((prev) => prev.filter((j) => j.id !== id));
  };

  const updateJarDose = (jarId: number, chemId: number, val: string) => {
    setJars((prev) =>
      prev.map((j) => (j.id === jarId ? { ...j, doses: { ...j.doses, [chemId]: val } } : j))
    );
  };

  const updateJarResult = (jarId: number, field: "turbF" | "colorF" | "phF", val: string) => {
    setJars((prev) => prev.map((j) => (j.id === jarId ? { ...j, [field]: val } : j)));
  };

  const compararJarras = () => {
    if (flow <= 0) {
      showToast("Ingrese el caudal de operacion", "error");
      return;
    }

    const jarData = jars.map((j) => {
      const dosesByFunc: Record<ChemFunc, number> = { coag: 0, ph: 0, helper: 0, oxid: 0 };
      chemicals.forEach((c) => {
        if (c.func !== "oxid") {
          dosesByFunc[c.func] = n(j.doses[c.id] || "0");
        }
      });
      return { id: j.id, doses: dosesByFunc, turb: n(j.turbF) };
    });

    // Pick winner: prefer turb > 0 and < 1, else lowest turb
    const candidates = jarData.filter((j) => j.turb > 0 && j.turb < 1);
    const best =
      candidates.length > 0
        ? candidates.sort((a, b) => a.turb - b.turb)[0]
        : jarData.sort((a, b) => a.turb - b.turb)[0];

    setValidatedDoses(best.doses);
    setBestJarId(best.id);
    setShowSimResults(true);
    showToast(`Vaso 0${best.id} seleccionado como ganador`, "success");
  };

  const updateChemPrice = (id: number, val: string) => {
    setChemicals((prev) =>
      prev.map((c) => (c.id === id ? { ...c, price: parseFloat(val) || 0 } : c))
    );
  };

  const resetForm = () => {
    setPlantFlow("");
    setOpHours("24");
    setChemicals(DEFAULT_CHEMICALS);
    setNewChemName("");
    setNewChemFunc("coag");
    setNewChemConc("10");
    setBaselineAforos({});
    setSimTurb("0");
    setSimPh("7.0");
    setSimColor("0");
    setSimFe("0.00");
    setExtraParams([]);
    setNewParamName("");
    setAiDiagnosis("");
    setShowAiPanel(false);
    setShowSimResults(false);
    setJars([
      { id: 1, doses: {}, turbF: "", colorF: "", phF: "" },
      { id: 2, doses: {}, turbF: "", colorF: "", phF: "" },
      { id: 3, doses: {}, turbF: "", colorF: "", phF: "" },
      { id: 4, doses: {}, turbF: "", colorF: "", phF: "" },
    ]);
    setNextJarId(5);
    setValidatedDoses(null);
    setBestJarId(null);
    setClApplied("0");
    setClMeasured("0");
    setClTarget("1.0");
    setRepoOrg("");
    setRepoSample("");
    setRepoObs("");
  };

  // PDF report
  const emitirMemoria = async () => {
    if (!repoOrg.trim()) {
      showToast("Entidad requerida para generar memoria", "error");
      return;
    }

    const allParams = [
      { label: "Turbiedad (NTU)", val: turb },
      { label: "pH Crudo", val: ph },
      { label: "Color (UC)", val: col },
      { label: "Hierro (mg/L)", val: fe },
      ...extraParams.map((p) => ({ label: p.label, val: n(p.value) })),
    ];

    const baselineData = chemicals.map((c) => ({
      name: c.name,
      aforo: n(baselineAforos[c.id] || "0"),
      conc: c.conc,
      mgl: calcBaselineMgL(n(baselineAforos[c.id] || "0"), c.conc, flow),
    }));

    const title = hasBaseline
      ? "MEMORIA TECNICA DE OPTIMIZACION"
      : "MEMORIA TECNICA DE DISENO Y POTABILIZACION";

    const win = window.open("", "_blank");
    if (!win) {
      showToast("Habilite ventanas emergentes", "error");
      return;
    }

    const exportId = new Date().getTime();
    const exportDate = new Date().toLocaleString();
    const clientInfo = user?.name || user?.email || "TeraH2O";
    win.document.write(`<html><head><title>Memoria Tecnica - Tera Engineering</title>
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
        .footer{margin-top:40px;text-align:center;border-top:1px solid #eee;padding-top:15px}
      </style></head><body>
      <div class="header"><div><h1 style="margin:0;font-size:20px">${title}</h1><p style="margin:3px 0;font-weight:bold">TeraH2O - Ingenieria de Potabilizacion</p><p style="margin:2px 0;color:#64748b">Generado por: <b>${clientInfo}</b></p></div><div style="text-align:right"><b>EXP:</b> ${exportId}<br><b>Fecha:</b> ${exportDate}</div></div>
      <div class="section-title">1. Resumen Operativo de Planta</div>
      <table><tr><td><b>Entidad:</b></td><td>${repoOrg}</td><td><b>Horas Operacion:</b></td><td>${hours} h/dia</td></tr><tr><td><b>Caudal:</b></td><td>${flow} L/s</td><td><b>Volumen/Dia:</b></td><td>${dailyVolume.toFixed(1)} m3</td></tr><tr><td><b>Ubicacion:</b></td><td colspan="3">${repoSample || "S/N"}</td></tr></table>
      <div class="section-title">2. Caracterizacion Integral del Agua Cruda</div>
      <div class="param-grid">${allParams.map((p) => `<div><b>${p.label}:</b> ${p.val}</div>`).join("")}</div>
      ${aiDiagnosis && aiDiagnosis !== "IA analizando parametros..." ? `<div class="ai-box"><b>Diagnostico IA Expert:</b> ${aiDiagnosis}</div>` : ""}
      ${
        hasBaseline
          ? `<div class="section-title">3. Comparativa: Linea Base vs. Optimizacion Proyectada</div><table><thead><tr><th>Insumo Tecnico</th><th>Aforo Base</th><th>Dosis Base</th><th>Dosis Meta</th><th>Diferencia</th></tr></thead><tbody>${baselineData
              .map((b) => {
                const chem = chemicals.find((c) => c.name === b.name);
                const optDose = chem ? (chem.func === "oxid" ? activeDoses.oxid : activeDoses[chem.func] || 0) : 0;
                return `<tr><td>${b.name}</td><td>${b.aforo.toFixed(1)} ml/min</td><td>${b.mgl.toFixed(1)} mg/L</td><td>${optDose.toFixed(1)} mg/L</td><td>${(optDose - b.mgl).toFixed(1)} mg/L</td></tr>`;
              })
              .join("")}</tbody></table>`
          : ""
      }
      <div class="section-title">${hasBaseline ? "4" : "3"}. Validacion de Laboratorio y Plan de Dosificacion</div>
      <div class="highlight-box"><b>DOSIS VALIDADA:</b> Configuracion tecnica para cumplimiento INEN 1108.<br><br><b>Coagulacion:</b> ${activeDoses.coag.toFixed(1)} mg/L | <b>Regulacion pH:</b> ${activeDoses.ph.toFixed(1)} mg/L | <b>Floculacion:</b> ${activeDoses.helper.toFixed(1)} mg/L | <b>Oxidacion:</b> ${activeDoses.oxid.toFixed(1)} mg/L</div>
      <table><thead><tr><th>Insumo</th><th>Aforo Sugerido (ml/min)</th><th>Consumo Diario (kg)</th><th>Consumo Mensual (kg)</th></tr></thead><tbody>${chemicals
        .map((c) => {
          const d = activeDoses[c.func] || 0;
          const aforo = c.conc > 0 ? (d * flow * 60) / (c.conc * 10) : 0;
          const dailyKg = (d * flow * 3.6 * hours) / 1000;
          const monthlyKg = dailyKg * 30;
          return `<tr><td>${c.name}</td><td>${aforo.toFixed(1)} ml/min</td><td>${dailyKg.toFixed(2)} kg</td><td>${monthlyKg.toFixed(1)} kg</td></tr>`;
        })
        .join("")}</tbody></table>
      <div class="section-title">${hasBaseline ? "5" : "4"}. Analisis Economico y Eficiencia</div>
      <div style="background:#0a192f;color:white;padding:15px;border-radius:6px;display:grid;grid-template-columns:repeat(${hasBaseline ? 3 : 2}, 1fr);gap:10px">
        <div>COSTO UNITARIO:<br><b>${costPerM3.toFixed(4)} USD/m3</b></div><div>INVERSION MES:<br><b>$ ${totalOptCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}</b></div>${hasBaseline ? `<div>AHORRO DETECTADO:<br><b>$ ${savings > 0 ? savings.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}</b><br><small>Eficiencia: ${efficiency.toFixed(1)}%</small></div>` : ""}
      </div>
      <div class="section-title">${hasBaseline ? "6" : "5"}. Observaciones Tecnicas Finales</div>
      <div style="padding:10px;border:1px solid #e2e8f0;min-height:70px;font-style:italic">${repoObs || "Sin observaciones."}</div>
      <div class="footer"><p>TeraH2O - Software de Ingenieria de Tratamiento de Agua Potable</p><br><b>__________________________</b><br>DOCUMENTO VALIDO DIGITALMENTE</div></body></html>`);

    win.document.close();
    win.print();

    try {
      const today = new Date().toISOString().split("T")[0];
      await createJarTest({
        date: today,
        organizationName: repoOrg,
        samplePoint: repoSample || "N/A",
        plantFlow: flow,
        opHours: hours,
        rawWaterParams: [
          { label: "Turbiedad (NTU)", value: turb },
          { label: "pH Crudo", value: ph },
          { label: "Color (UC)", value: col },
          { label: "Hierro (mg/L)", value: fe },
          ...extraParams.map((p) => ({ label: p.label, value: n(p.value) })),
        ],
        chemicals: chemicals.map((c) => ({
          name: c.name,
          func: c.func,
          concentration: c.conc,
          pricePerKg: c.price,
        })),
        observations: repoObs || undefined,
        aiDiagnosis: aiDiagnosis && aiDiagnosis !== "IA analizando parametros..." ? aiDiagnosis : undefined,
      });
      await createBitacora({
        date: today,
        source: "Consola Tecnica",
        category: "Jar-Test",
        summary: `Jar-Test — ${repoOrg} — Costo/m³: $${costPerM3.toFixed(4)} — Ganadora: Vaso ${bestJarId ?? "N/A"}`,
      });
      showToast("Memoria generada", "success");
      resetForm();
    } catch (err) {
      console.error("Error al guardar jar-test:", err);
      showToast("Error al guardar en base de datos", "error");
    }
  };

  /* ── Render ────────────────────────────────────────────── */

  return (
    <AuthGuard permissionKey={["canAccessOperaciones", "canAccessConsolaTecnica"]} moduleName="Consola Tecnica">
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-navy-deep text-white py-5 px-6 shadow-2xl dot-grid border-b-[3px] border-transparent"
        style={{ borderImage: "linear-gradient(90deg, transparent, #0ea5e9, transparent) 1" }}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/operaciones"
              className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center font-black text-white shadow-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-black uppercase leading-none tracking-tight">
                Consola Tecnica PTAP
              </h1>
              <p className="text-[9px] font-bold text-sky-400 uppercase tracking-[0.2em] mt-1">
                Optimizacion y Diseno
              </p>
            </div>
          </div>
          <NavbarUser />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto w-full px-5 py-10 space-y-10 flex-1">
        {/* ── S00: LINEA BASE ──────────────────────────────── */}
        <section className="bg-white rounded-2xl p-7 border-t-[6px] border-amber-500 shadow-sm">
          <div className="flex justify-between items-center mb-6 border-b pb-3">
            <h2 className="text-sm font-black text-navy-deep uppercase flex items-center gap-2">
              <Beaker className="w-4 h-4 text-amber-500" />
              00. Linea Base (Aforo de Bomba y % Conc.)
            </h2>
            <span className="text-amber-600 text-[10px] font-bold uppercase tracking-wide">
              Dosificacion de Operacion
            </span>
          </div>

          {chemicals.length === 0 ? (
            <p className="text-center py-4 text-slate-400 text-xs">
              Registre productos en la Seccion 01 para configurar la linea base.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {chemicals.map((c) => {
                const aforo = n(baselineAforos[c.id] || "0");
                const mgl = calcBaselineMgL(aforo, c.conc, flow);
                return (
                  <div key={c.id} className="bg-slate-50/50 p-3 rounded-xl border border-amber-100/50">
                    <label className={`block text-[9px] font-black uppercase mb-2 ${FUNC_TEXT_COLORS[c.func]}`}>
                      {c.name}
                    </label>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[7px] text-slate-400 uppercase font-black mb-1">
                          Aforo Bomba (ml/min)
                        </p>
                        <input
                          type="number"
                          value={baselineAforos[c.id] || ""}
                          onChange={(e) => updateBaselineAforo(c.id, e.target.value)}
                          className="w-full py-1.5 px-2 text-center font-black text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                        />
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[7px] font-black text-slate-400 uppercase">
                          Dosis:
                        </span>
                        <span className="text-[10px] font-black text-amber-600">
                          {mgl.toFixed(1)} mg/L
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── S01 + S02 Grid ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* S01: PLANTA E INSUMOS */}
          <section className="lg:col-span-5 bg-white rounded-2xl p-7 border-t-[6px] border-navy-deep shadow-sm">
            <h2 className="text-sm font-black text-navy-deep uppercase mb-6 border-b pb-3 flex justify-between items-center">
              <span className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-sky-500" />
                01. Planta e Insumos
              </span>
              <span className="text-sky-500 text-[10px] font-bold">Optimizacion</span>
            </h2>

            <div className="space-y-6">
              {/* Flow + Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Caudal de Operacion (L/s)
                  </label>
                  <input
                    type="number"
                    value={plantFlow}
                    onChange={(e) => setPlantFlow(e.target.value)}
                    placeholder="0.0"
                    className="w-full text-center text-2xl font-black text-sky-600 py-2 px-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Horas Operacion / Dia
                  </label>
                  <input
                    type="number"
                    value={opHours}
                    onChange={(e) => setOpHours(e.target.value)}
                    min={1}
                    max={24}
                    className="w-full text-center text-2xl font-black text-navy-deep py-2 px-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              {/* Chemical list */}
              <div className="border-t pt-5">
                <label className="block text-[9px] font-black text-navy-deep uppercase mb-3">
                  Inventario de Productos para la Prueba
                </label>
                <div className="space-y-2.5 mb-4">
                  {chemicals.map((c) => (
                    <div
                      key={c.id}
                      className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 text-xs shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`${FUNC_COLORS[c.func]} text-white shadow-sm font-black px-2 py-0.5 rounded text-[8px] uppercase`}
                        >
                          {FUNC_LABELS[c.func]}
                        </span>
                        <div>
                          <p className="font-black text-navy-deep leading-none mb-1">{c.name}</p>
                          <span className="text-[8px] font-bold text-slate-400">
                            Conc: {c.conc}%
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeChemical(c.id)}
                        className="text-red-300 hover:text-red-500 font-black px-2"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add chemical form */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                  <input
                    type="text"
                    value={newChemName}
                    onChange={(e) => setNewChemName(e.target.value)}
                    placeholder="Nombre comercial"
                    className="w-full py-2 px-3 text-xs rounded-lg border border-slate-200 mb-2 focus:outline-none focus:border-sky-400"
                  />
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <select
                      value={newChemFunc}
                      onChange={(e) => setNewChemFunc(e.target.value as ChemFunc)}
                      className="py-2 px-2 text-[10px] rounded-lg border border-slate-200 focus:outline-none"
                    >
                      <option value="coag">Coagulante</option>
                      <option value="ph">Regulador pH</option>
                      <option value="helper">Ayudante Mezcla</option>
                      <option value="oxid">Agente Oxidante</option>
                    </select>
                    <input
                      type="number"
                      value={newChemConc}
                      onChange={(e) => setNewChemConc(e.target.value)}
                      placeholder="% Conc."
                      className="py-2 px-3 text-xs rounded-lg border border-slate-200 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={addChemical}
                    className="w-full bg-navy-deep text-white font-bold py-2 rounded-lg hover:bg-sky-600 transition-colors text-xs flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> Registrar Producto
                  </button>
                </div>
              </div>

              {/* Daily production */}
              <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                  Produccion Real Diaria
                </p>
                <p className="text-xl font-bold text-navy-deep">
                  {dailyVolume.toFixed(1)} m3/dia
                </p>
              </div>
            </div>
          </section>

          {/* S02: CARACTERIZACION AGUA CRUDA */}
          <section className="lg:col-span-7 bg-white rounded-2xl p-7 border-t-[6px] border-navy-deep shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h2 className="text-sm font-black text-navy-deep uppercase flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-500" />
                02. Caracterizacion Agua Cruda
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newParamName}
                  onChange={(e) => setNewParamName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addExtraParam()}
                  placeholder="Nombre del parametro"
                  className="py-1.5 px-2 text-[10px] rounded-lg border border-slate-200 focus:outline-none focus:border-sky-400 w-44"
                />
                <button
                  onClick={addExtraParam}
                  className="bg-navy-deep/80 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase hover:bg-navy-deep transition-colors"
                >
                  + Agregar
                </button>
              </div>
            </div>

            {/* Base params */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                  Turbiedad (NTU)
                </label>
                <input
                  type="number"
                  value={simTurb}
                  onChange={(e) => setSimTurb(e.target.value)}
                  className="w-full py-2 px-3 font-bold text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                  pH Crudo
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={simPh}
                  onChange={(e) => setSimPh(e.target.value)}
                  className="w-full py-2 px-3 font-bold text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                  Color (UC)
                </label>
                <input
                  type="number"
                  value={simColor}
                  onChange={(e) => setSimColor(e.target.value)}
                  className="w-full py-2 px-3 font-bold text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                  Hierro (mg/L)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={simFe}
                  onChange={(e) => setSimFe(e.target.value)}
                  className="w-full py-2 px-3 font-bold text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* Extra params */}
            {extraParams.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mt-4">
                {extraParams.map((p) => (
                  <div key={p.key} className="relative group">
                    <label className="block text-[9px] font-black text-sky-600 uppercase mb-1">
                      {p.label}
                    </label>
                    <input
                      type="number"
                      value={p.value}
                      onChange={(e) => updateExtraParam(p.key, e.target.value)}
                      className="w-full py-2 px-3 font-bold text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400"
                    />
                    <button
                      onClick={() => removeExtraParam(p.key)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[8px] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={ejecutarSimulacion}
                className="flex-1 bg-gradient-to-r from-navy-deep to-blue-900 text-white font-black uppercase tracking-wide py-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm"
              >
                Simular Dosis Sugerida
              </button>
              <button
                onClick={consultarIA}
                disabled={loadingAI}
                className={`flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all ${loadingAI ? "animate-pulse opacity-70" : ""}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {loadingAI ? "Analizando..." : "Analisis IA Potabilidad"}
              </button>
            </div>

            {/* AI Panel */}
            {showAiPanel && (
              <div className="mt-4 p-4 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-900 leading-relaxed">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-violet-500 rounded-full" />
                  <span className="font-black uppercase tracking-widest text-[9px]">
                    Analisis Cognitivo del Crudo
                  </span>
                </div>
                <div className={loadingAI ? "animate-pulse" : ""}>{aiDiagnosis}</div>
              </div>
            )}
          </section>
        </div>

        {/* ── SIMULATION RESULTS ───────────────────────────── */}
        {showSimResults && (
          <section className="bg-[#0f172a] rounded-3xl p-8 shadow-2xl">
            <h3 className="text-sky-400 font-black text-[10px] uppercase tracking-[0.3em] mb-8 text-center border-b border-white/10 pb-4">
              Modelado Teorico de Dosificacion
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
              {chemicals.map((c) => (
                <div key={c.id}>
                  <p className={`${FUNC_TEXT_COLORS[c.func]} font-black text-[10px] uppercase mb-1 tracking-widest`}>
                    {c.name}
                  </p>
                  <p className="text-4xl font-black text-white">
                    {(activeDoses[c.func] || 0).toFixed(1)}
                  </p>
                  <span className="text-white/30 text-[8px] font-bold uppercase">
                    mg/L Diseno
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── S03: MATRIZ DE JARRAS ────────────────────────── */}
        <section className="bg-white rounded-2xl p-7 border-t-[6px] border-navy-deep shadow-sm">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <div>
              <h2 className="text-sm font-black text-navy-deep uppercase flex items-center gap-2">
                <Calculator className="w-4 h-4 text-sky-500" />
                03. Validacion Tecnica en Jarras
              </h2>
              <p className="text-[10px] font-bold text-slate-400 mt-1">
                Optimizacion fisico-quimica (Excluye Oxidacion/desinfeccion).
              </p>
            </div>
            <button
              onClick={addJar}
              className="bg-navy-deep/80 text-white font-bold px-4 py-2 rounded-lg text-[10px] uppercase hover:bg-navy-deep transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Nuevo Vaso
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {jars.map((jar, idx) => (
              <div
                key={jar.id}
                className={`bg-slate-50 border-2 rounded-2xl p-5 transition-all ${
                  bestJarId === jar.id
                    ? "border-emerald-400 bg-emerald-50/50"
                    : "border-slate-100 hover:border-sky-400"
                }`}
              >
                <h4 className="font-black text-navy-deep text-[10px] border-b pb-2 mb-4 uppercase flex justify-between">
                  <span>Vaso 0{idx + 1}</span>
                  <button
                    onClick={() => removeJar(jar.id)}
                    className="text-red-300 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </h4>

                {/* Chemical doses (exclude oxid) */}
                <div className="space-y-3 mb-5">
                  {chemicals
                    .filter((c) => c.func !== "oxid")
                    .map((c) => (
                      <div key={c.id}>
                        <label className="block text-[7px] font-black text-slate-400 uppercase mb-0.5">
                          Dosis {c.name}
                        </label>
                        <input
                          type="number"
                          value={jar.doses[c.id] || ""}
                          onChange={(e) => updateJarDose(jar.id, c.id, e.target.value)}
                          className="w-full py-1.5 px-2 text-center text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400"
                        />
                      </div>
                    ))}
                </div>

                {/* Final results */}
                <div className="grid grid-cols-3 gap-1 pt-4 border-t border-slate-200">
                  <div>
                    <label className="block text-[6px] font-black text-slate-400 uppercase mb-0.5">
                      Turb. F.
                    </label>
                    <input
                      type="number"
                      value={jar.turbF}
                      onChange={(e) => updateJarResult(jar.id, "turbF", e.target.value)}
                      className="w-full text-center py-1 px-1 text-[10px] font-black border border-slate-200 rounded focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[6px] font-black text-slate-400 uppercase mb-0.5">
                      Col. F.
                    </label>
                    <input
                      type="number"
                      value={jar.colorF}
                      onChange={(e) => updateJarResult(jar.id, "colorF", e.target.value)}
                      className="w-full text-center py-1 px-1 text-[10px] font-black border border-slate-200 rounded focus:outline-none focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[6px] font-black text-slate-400 uppercase mb-0.5">
                      pH F.
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={jar.phF}
                      onChange={(e) => updateJarResult(jar.id, "phF", e.target.value)}
                      className="w-full text-center py-1 px-1 text-[10px] font-black border border-slate-200 rounded focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={compararJarras}
            className="w-full mt-12 bg-gradient-to-r from-sky-600 to-blue-700 text-white font-black uppercase tracking-wide py-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm"
          >
            Validar y Sincronizar Vaso Ganador
          </button>
        </section>

        {/* ── BEST JAR RESULT ──────────────────────────────── */}
        {bestJarId !== null && validatedDoses && (
          <section className="bg-emerald-900 border-l-[14px] border-emerald-500 p-10 rounded-3xl shadow-2xl text-white">
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-white/10 pb-8">
                <div>
                  <span className="inline-block px-4 py-1 bg-emerald-500 text-white font-black rounded-full text-[10px] mb-3 uppercase tracking-widest">
                    Configuracion Ganadora
                  </span>
                  <h2 className="text-5xl sm:text-7xl font-black">
                    Vaso 0{jars.findIndex((j) => j.id === bestJarId) + 1}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-emerald-300 text-xs font-black uppercase tracking-widest">
                    Resultados de Laboratorio
                  </p>
                  <p className="text-white/50 text-[10px]">Parametros finales validados.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {chemicals
                  .filter((c) => c.func !== "oxid")
                  .map((c) => {
                    const dose = validatedDoses[c.func] || 0;
                    const mlm = c.conc > 0 ? (dose * flow * 60) / (c.conc * 10) : 0;
                    return (
                      <div key={c.id} className="bg-white/5 border border-white/10 p-4 rounded-xl">
                        <div className="flex justify-between mb-2">
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">
                            {c.name}
                          </span>
                          <span className="text-[9px] bg-white/10 px-2 rounded font-black">
                            {dose} mg/L
                          </span>
                        </div>
                        <div>
                          <p className="text-[7px] text-white/40 uppercase tracking-tighter">
                            Aforo Sugerido
                          </p>
                          <p className="text-xl font-black">
                            {mlm.toFixed(1)}{" "}
                            <span className="text-[8px]">ml/min</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        )}

        {/* ── S04: CALCULADORA DE CLORO ────────────────────── */}
        <section className="bg-white rounded-2xl p-7 border-t-[6px] border-navy-deep shadow-sm">
          <h2 className="text-sm font-black text-navy-deep uppercase mb-8 border-b pb-4 flex items-center gap-3">
            <span className="w-3 h-3 bg-sky-500 rounded-full" />
            04. Calculadora de Demanda de Oxidacion/Desinfeccion
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Dosis Aplicada (mg/L)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={clApplied}
                    onChange={(e) => setClApplied(e.target.value)}
                    className="w-full py-2 px-3 font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                    Residual Medido (mg/L)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={clMeasured}
                    onChange={(e) => setClMeasured(e.target.value)}
                    className="w-full py-2 px-3 font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                  Residual Meta Objetivo (mg/L)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={clTarget}
                  onChange={(e) => setClTarget(e.target.value)}
                  className="w-full py-2 px-3 font-bold border border-slate-200 rounded-lg bg-sky-50 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-3xl border-2 border-dashed border-sky-200 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2">
                Demanda Quimica del Agua Cruda
              </p>
              <p className="text-5xl font-black text-navy-deep mb-6">
                {chlorineDemand.toFixed(2)}
              </p>
              <p className="text-[10px] font-black text-sky-500 uppercase">
                Dosis Operativa Sugerida
              </p>
              <p className="text-6xl font-black text-sky-600">
                {chlorineOperativeDose.toFixed(2)}
              </p>
            </div>
          </div>
        </section>

        {/* ── S05: PRESUPUESTO Y COSTOS ────────────────────── */}
        {showSimResults && (
          <section className="bg-white rounded-2xl p-9 border-t-[6px] border-pink-500 shadow-sm">
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h2 className="text-sm font-black text-navy-deep uppercase">
                Analisis Presupuestario Final
              </h2>
              <span className="bg-navy-deep text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">
                Sincronizado
              </span>
            </div>

            {/* Finance table */}
            <div className="border rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-navy-deep text-white">
                    <th className="text-left p-4 font-black text-[9px] uppercase tracking-wide">
                      Insumo Tecnico
                    </th>
                    <th className="p-4 font-black text-[9px] uppercase tracking-wide">
                      Dosis Mg/L
                    </th>
                    <th className="p-4 font-black text-[9px] uppercase tracking-wide">
                      Aforo (ml/min)
                    </th>
                    <th className="p-4 font-black text-[9px] uppercase tracking-wide">
                      Masa Mes (kg)
                    </th>
                    <th className="p-4 font-black text-[9px] uppercase tracking-wide">
                      $/kg (Precio)
                    </th>
                    <th className="p-4 font-black text-[9px] uppercase tracking-wide">
                      Gasto Mensual ($)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {financeRows.map((row) => (
                    <tr
                      key={row.chemical.id}
                      className="hover:bg-slate-50 border-b border-slate-100"
                    >
                      <td className="font-bold p-4 text-left border-r bg-slate-50/50">
                        {row.chemical.name}
                      </td>
                      <td className="font-black text-slate-500 text-center p-4">
                        {row.dose.toFixed(1)}
                      </td>
                      <td className="font-black text-sky-600 text-center p-4">
                        {row.mlm.toFixed(1)}
                      </td>
                      <td className="font-bold text-navy-deep text-center p-4">
                        {Math.round(row.kgMonth).toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        <input
                          type="number"
                          step="0.01"
                          className="w-24 text-center py-1 px-2 border border-slate-200 text-xs font-bold rounded focus:outline-none focus:border-sky-400"
                          value={row.chemical.price.toFixed(2)}
                          onChange={(e) =>
                            updateChemPrice(row.chemical.id, e.target.value)
                          }
                        />
                      </td>
                      <td className="font-black text-navy-deep text-center p-4">
                        ${" "}
                        {row.cost.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Finance summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
              <div className="bg-navy-deep text-white p-8 rounded-2xl text-center shadow-2xl">
                <p className="text-sky-400 font-black text-[9px] uppercase tracking-widest mb-2">
                  Costo Unitario Real
                </p>
                <p className="text-3xl font-black text-emerald-400 font-mono">
                  {costPerM3.toFixed(4)}
                </p>
                <p className="text-white/20 text-[8px] mt-1 font-bold">USD / m3</p>
              </div>
              <div className="bg-white border-2 border-slate-100 p-8 rounded-2xl text-center shadow-sm">
                <p className="text-slate-400 font-black text-[9px] uppercase tracking-widest mb-2">
                  Inversion Mensual Estimada
                </p>
                <p className="text-3xl font-black text-navy-deep">
                  ${" "}
                  {totalOptCost.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </p>
                <p className="text-slate-300 text-[8px] mt-1 font-bold">
                  Presupuesto Sugerido
                </p>
              </div>
              {hasBaseline && (
                <div className="bg-emerald-50 border-2 border-emerald-200 p-8 rounded-2xl text-center">
                  <p className="text-emerald-600 font-black text-[9px] uppercase tracking-widest mb-2">
                    Ahorro Mensual Detectado
                  </p>
                  <p className="text-3xl font-black text-emerald-700">
                    ${" "}
                    {savings > 0
                      ? savings.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })
                      : "0.00"}
                  </p>
                  <p className="text-emerald-300 text-[8px] mt-1 font-bold">
                    Eficiencia: {efficiency.toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── REPORT SECTION ───────────────────────────────── */}
        <section className="bg-white rounded-2xl p-10 border-t-[6px] border-emerald-500 shadow-sm">
          <h2 className="text-2xl font-black text-navy-deep uppercase text-center mb-10 flex items-center justify-center gap-3">
            <FileText className="w-6 h-6 text-emerald-500" />
            Generacion de Memoria Tecnica
          </h2>
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                  Entidad / Organizacion Responsable
                </label>
                <input
                  type="text"
                  value={repoOrg}
                  onChange={(e) => setRepoOrg(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full py-3 px-4 font-bold border border-slate-200 rounded-xl focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                  Punto de Muestreo / Captacion
                </label>
                <input
                  type="text"
                  value={repoSample}
                  onChange={(e) => setRepoSample(e.target.value)}
                  placeholder="Identificacion tecnica"
                  className="w-full py-3 px-4 font-bold border border-slate-200 rounded-xl focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">
                Observaciones Tecnicas y Recomendaciones Finales
              </label>
              <textarea
                value={repoObs}
                onChange={(e) => setRepoObs(e.target.value)}
                rows={5}
                placeholder="Comentarios finales..."
                className="w-full py-3 px-4 font-bold border border-slate-200 rounded-xl focus:outline-none focus:border-sky-400 resize-none"
              />
            </div>
            <button
              onClick={emitirMemoria}
              className="w-full bg-gradient-to-r from-navy-deep to-blue-900 text-white font-black uppercase tracking-wide py-5 rounded-xl shadow-2xl hover:shadow-xl transition-all text-sm"
            >
              Generar Memoria Tecnica Integral (PDF)
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <div className="bg-navy-deep">
        <Footer />
      </div>

      <Toast {...toast} />
    </div>
    </AuthGuard>
  );
}
