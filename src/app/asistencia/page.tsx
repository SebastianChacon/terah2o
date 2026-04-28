"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { INEN_1108_PARAMS, IVA_RATE } from "@/lib/constants";
import { calculateDose, calculateDailyConsumption, calculateAutonomy } from "@/lib/calculations/dosification";
import { CHEMICAL_PRODUCTS } from "@/types/chemical";
import { useGemini } from "@/hooks/useGemini";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { InputField } from "@/components/ui/InputField";
import { ComplianceGauge } from "@/components/ui/ComplianceGauge";
import { AiButton } from "@/components/ai/AiButton";
import { useSafeMutation, useSafeQuery } from "@/hooks/useConvex";
import { api } from "../../../convex/_generated/api";
import { exportToExcel } from "@/lib/export/excel";

interface DosageRow {
  id: number;
  product: string;
  mlMin: string;
  concPct: string;
  stockKg: string;
}

interface ParamRow {
  name: string;
  limit: number;
  min: number;
  unit: string;
  raw: string;
  treated: string;
}

interface QuoteRow {
  id: number;
  prod: string;
  qty: string;
  price: string;
}

type TabKey = "recoleccion" | "comercial" | "historial";

export default function AsistenciaPage() {
  const { toast, showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("recoleccion");
  const [tipoCliente, setTipoCliente] = useState<"CARTERA" | "POTENCIAL">("CARTERA");

  /* ── Archivo Central: Convex data ──────────────────────── */
  const allVisitas = useSafeQuery(api.visitas.getAll);
  const [archiveSearch, setArchiveSearch] = useState("");

  const cartera = (allVisitas ?? []).filter((v: NonNullable<typeof allVisitas>[number]) => v.tipoCliente === "CARTERA");
  const prospectos = (allVisitas ?? []).filter((v: NonNullable<typeof allVisitas>[number]) => v.tipoCliente === "POTENCIAL");

  const aq = archiveSearch.toLowerCase();
  const filteredCartera = cartera.filter((v: NonNullable<typeof allVisitas>[number]) =>
    !aq || `${v.org} ${v.provincia} ${v.canton}`.toLowerCase().includes(aq)
  );
  const filteredProspectos = prospectos.filter((v: NonNullable<typeof allVisitas>[number]) =>
    !aq || `${v.org} ${v.provincia} ${v.canton}`.toLowerCase().includes(aq)
  );

  function exportCarteraExcel() {
    if (filteredCartera.length === 0) return showToast("No hay datos de cartera para exportar.", "error");
    exportToExcel(
      filteredCartera.map((v: NonNullable<typeof allVisitas>[number]) => ({
        Fecha: new Date(v._creationTime).toLocaleDateString("es-EC"),
        Institución: v.org,
        Ubicación: `${v.provincia ?? ""} - ${v.canton ?? ""}`,
        Teléfono: v.telefono,
        "Cumplimiento %": v.compliance ?? "—",
      })),
      "Cartera Técnica",
      `Cartera_Tecnica_${new Date().toISOString().slice(0, 10)}`
    );
    showToast("Excel de Cartera Técnica descargado.", "info");
  }

  function exportProspectosExcel() {
    if (filteredProspectos.length === 0) return showToast("No hay datos de prospectos para exportar.", "error");
    exportToExcel(
      filteredProspectos.map((v: NonNullable<typeof allVisitas>[number]) => ({
        Fecha: new Date(v._creationTime).toLocaleDateString("es-EC"),
        Prospecto: v.org,
        Provincia: v.provincia ?? "—",
        "Total Ofertado": v.comercial?.totalQuote ?? "—",
        Contacto: v.telefono,
      })),
      "Pipeline Comercial",
      `Pipeline_Comercial_${new Date().toISOString().slice(0, 10)}`
    );
    showToast("Excel de Prospectos descargado.", "info");
  }

  // Form state
  const [org, setOrg] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [autoridad, setAutoridad] = useState("");
  const [tecnicoPlanta, setTecnicoPlanta] = useState("");
  const [provincia, setProvincia] = useState("");
  const [canton, setCanton] = useState("");
  const [caudal, setCaudal] = useState("");
  const [horasOp, setHorasOp] = useState("24");
  const [observaciones, setObservaciones] = useState("");

  // Params
  const [params, setParams] = useState<ParamRow[]>(
    INEN_1108_PARAMS.map((p) => ({
      name: p.name,
      limit: p.limit,
      min: p.min ?? 0,
      unit: p.unit,
      raw: "",
      treated: "",
    }))
  );

  // Dosage rows
  const [dosageRows, setDosageRows] = useState<DosageRow[]>([
    { id: 1, product: "PAC", mlMin: "", concPct: "", stockKg: "" },
  ]);

  // Commercial
  const [comProveedor, setComProveedor] = useState("");
  const [comAdquisicion, setComAdquisicion] = useState("Compra Directa");
  const [comContratacion, setComContratacion] = useState("Ínfima Cuantía");
  const [comFechaCompra, setComFechaCompra] = useState("");
  const [comComentarios, setComComentarios] = useState("");
  const [marketProducts, setMarketProducts] = useState<string[]>([]);

  // Quote
  const [quoteRows, setQuoteRows] = useState<QuoteRow[]>([
    { id: 1, prod: "", qty: "0", price: "0" },
  ]);

  // AI
  const { generate: generateTech, loading: loadingTech } = useGemini({ context: "technical-diagnosis" });
  const { generate: generateCom, loading: loadingCom } = useGemini({ context: "commercial-strategy" });

  // Compliance calculation
  const getCompliance = useCallback(() => {
    const filled = params.filter((p) => p.treated !== "");
    if (filled.length === 0) return 100;
    const ok = filled.filter((p) => {
      const val = parseFloat(p.treated);
      return !isNaN(val) && val <= p.limit && val >= p.min;
    });
    return Math.round((ok.length / filled.length) * 100);
  }, [params]);

  const compliance = getCompliance();

  // Dose calculation for each row
  const getDoseResult = useCallback(
    (row: DosageRow) => {
      const flow = parseFloat(caudal) || 0;
      const hours = parseFloat(horasOp) || 0;
      const mlMin = parseFloat(row.mlMin) || 0;
      const conc = parseFloat(row.concPct) || 0;
      const stock = parseFloat(row.stockKg) || 0;

      if (flow <= 0 || mlMin <= 0 || conc <= 0) return { dose: 0, days: "---" };
      const dose = calculateDose(mlMin, conc, flow);
      const dailyCons = calculateDailyConsumption(dose, flow, hours);
      const autonomy = calculateAutonomy(stock, dailyCons);
      return {
        dose: dose.toFixed(2),
        days: stock > 0 && dailyCons > 0 ? autonomy.toFixed(1) : "---",
      };
    },
    [caudal, horasOp]
  );

  // Quote totals
  const quoteSubtotal = quoteRows.reduce((sum, r) => {
    return sum + (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0);
  }, 0);
  const quoteTax = quoteSubtotal * IVA_RATE;
  const quoteTotal = quoteSubtotal + quoteTax;

  // Param status
  const getParamStatus = (p: ParamRow): "ok" | "fail" | "neutral" => {
    if (p.treated === "") return "neutral";
    const val = parseFloat(p.treated);
    if (isNaN(val)) return "neutral";
    return val <= p.limit && val >= p.min ? "ok" : "fail";
  };

  // AI handlers
  const handleAiTech = async () => {
    const paramsData = params
      .filter((p) => p.treated !== "")
      .map((p) => ({
        name: p.name,
        raw: p.raw,
        treated: p.treated,
        limit: p.limit,
      }));
    const doses = dosageRows.map((r) => ({
      product: r.product,
      dose: getDoseResult(r).dose,
    }));
    const prompt = `Analiza los siguientes datos de una planta de tratamiento:
Parámetros (Norma INEN 1108): ${JSON.stringify(paramsData)}
Régimen de dosificación actual: ${JSON.stringify(doses)}
Nivel de cumplimiento global: ${compliance}%

Por favor, proporciona un diagnóstico técnico corto (máximo 120 palabras) y sugiere ajustes específicos en la dosificación si hay desviaciones.`;

    const result = await generateTech(prompt);
    if (result) {
      setObservaciones((prev) =>
        prev
          ? `${prev}\n\n--- ANÁLISIS INTELIGENTE ---\n${result}`
          : `--- ANÁLISIS INTELIGENTE ---\n${result}`
      );
      showToast("Análisis completado con éxito.", "success");
    }
  };

  const handleAiCom = async () => {
    const prompt = `Desarrolla una estrategia de ventas flash basada en:
Competencia actual: ${comProveedor}
Modalidad de compra: ${comContratacion}
Productos que consumen: ${marketProducts.join(", ")}
Contexto adicional: ${comComentarios}

Genera 3 puntos clave de negociación resaltando eficiencia técnica y valor agregado profesional. Máximo 100 palabras.`;

    const result = await generateCom(prompt);
    if (result) {
      setComComentarios((prev) =>
        prev
          ? `${prev}\n\n--- ANÁLISIS INTELIGENTE ---\n${result}`
          : `--- ANÁLISIS INTELIGENTE ---\n${result}`
      );
      showToast("Análisis completado con éxito.", "success");
    }
  };

  const createVisita = useSafeMutation(api.visitas.create);
  const createBitacora = useSafeMutation(api.bitacoraEntries.create);

  const handleFinalize = async () => {
    if (!org || !telefono) {
      showToast("Nombre del Cliente y Teléfono son obligatorios.", "error");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    try {
      await createVisita({
        tipoCliente,
        org,
        telefono,
        correo: correo || undefined,
        autoridad: autoridad || undefined,
        tecnicoPlanta: tecnicoPlanta || undefined,
        provincia: provincia || undefined,
        canton: canton || undefined,
        caudal: parseFloat(caudal) || undefined,
        horasOperacion: parseFloat(horasOp) || undefined,
        compliance,
        observaciones: observaciones || undefined,
        params: params
          .filter((p) => p.treated !== "")
          .map((p) => ({
            name: p.name,
            raw: p.raw ? parseFloat(p.raw) : undefined,
            treated: parseFloat(p.treated),
            limit: p.limit,
            ok: (() => { const val = parseFloat(p.treated); return !isNaN(val) && val <= p.limit && val >= p.min; })(),
          })),
        dosages: dosageRows.map((row) => {
          const res = getDoseResult(row);
          return { product: row.product, mgL: String(res.dose), days: String(res.days) };
        }),
        comercial: {
          proveedor: comProveedor || undefined,
          marketProducts,
          adquisicion: comAdquisicion || undefined,
          contratacion: comContratacion || undefined,
          fechaCompra: comFechaCompra || undefined,
          comentarios: comComentarios || undefined,
          cotizacion: quoteRows.map((r) => ({
            prod: r.prod,
            qty: r.qty,
            price: r.price,
            total: String(parseFloat(r.qty || "0") * parseFloat(r.price || "0")),
          })),
          totalQuote: String(quoteRows.reduce((s, r) => s + parseFloat(r.qty || "0") * parseFloat(r.price || "0"), 0)),
        },
      });
      await createBitacora({
        date: today,
        source: "Asistencia Técnica",
        category: "Asistencia",
        summary: `Visita ${tipoCliente} — ${org} — Cumplimiento: ${compliance}%`,
      });
      showToast("Gestión finalizada con éxito.", "success");
    } catch (err) {
      console.error("Error al guardar visita:", err);
      showToast("Error al guardar en base de datos", "error");
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "recoleccion", label: "Captura Técnica" },
    { key: "comercial", label: "Gestión Comercial" },
    { key: "historial", label: "Archivo Central" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-36">
      <Toast {...toast} />

      {/* Header */}
      <header className="bg-navy-blue p-10 md:p-14 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white/60 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <span className="bg-white/10 text-[10px] font-black px-4 py-1.5 rounded-full tracking-[0.2em] uppercase border border-white/20">
                SERVICIOS PROFESIONALES TERA
              </span>
            </div>
            <NavbarUser />
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
            Sistema Inteligente de Asistencia Técnica Multicliente
          </h1>
          <p className="text-blue-200 mt-3 text-lg font-light italic opacity-70">
            Gestión Potabilización y Suministros.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-center md:justify-start overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-10 py-6 text-[10px] font-black uppercase tracking-[0.25em] whitespace-nowrap transition-all ${
                activeTab === t.key ? "tab-active" : "opacity-40"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        {/* CAPTURA TÉCNICA */}
        {activeTab === "recoleccion" && (
          <div className="space-y-10 fade-in">
            {/* 01. Identificación */}
            <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 card-shadow">
              <SectionHeader number="01" title="Identificación del Cliente">
                <select
                  value={tipoCliente}
                  onChange={(e) => setTipoCliente(e.target.value as "CARTERA" | "POTENCIAL")}
                  className="p-3 rounded-xl font-black border-2 border-navy-blue text-navy-blue text-xs uppercase"
                >
                  <option value="CARTERA">CLIENTE ACTIVO</option>
                  <option value="POTENCIAL">PROSPECTO POTENCIAL</option>
                </select>
              </SectionHeader>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                  <InputField label="Institución / Empresa / GAD" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Nombre completo" />
                </div>
                <InputField label="Teléfono / WhatsApp" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 0998887766" />
                <div className="md:col-span-2">
                  <InputField label="Correo Electrónico" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="cliente@entidad.com" />
                </div>
                <InputField label="Gerente / Responsable" value={autoridad} onChange={(e) => setAutoridad(e.target.value)} />
                <InputField label="Técnico en Planta" value={tecnicoPlanta} onChange={(e) => setTecnicoPlanta(e.target.value)} />
                <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-slate-100 mt-2">
                  <InputField label="Provincia" value={provincia} onChange={(e) => setProvincia(e.target.value)} />
                  <InputField label="Cantón / Ciudad" value={canton} onChange={(e) => setCanton(e.target.value)} />
                  <InputField label="Caudal (L/s)" type="number" step="0.01" value={caudal} onChange={(e) => setCaudal(e.target.value)} className="font-black text-navy-blue" />
                  <InputField label="Horas Op/Día" type="number" step="0.5" value={horasOp} onChange={(e) => setHorasOp(e.target.value)} className="font-black" />
                </div>
              </div>
            </section>

            {/* 02. Protocolo INEN 1108 */}
            <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 card-shadow">
              <SectionHeader number="02" title="Protocolo Analítico INEN 1108" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="sticky top-14 z-10">
                    <tr className="bg-slate-50 text-[10px] uppercase text-slate-400 font-black border-b">
                      <th className="p-6 text-left min-w-[200px]">Parámetro Técnico</th>
                      <th className="p-6 text-center min-w-[150px]">Agua Cruda</th>
                      <th className="p-6 text-center min-w-[150px]">Agua Tratada</th>
                      <th className="p-6 text-left min-w-[180px]">Validación Norma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {params.map((p, idx) => {
                      const status = getParamStatus(p);
                      return (
                        <tr key={p.name}>
                          <td className="p-6 font-black text-[11px] text-navy-blue uppercase tracking-tighter">
                            {p.name}{" "}
                            <span className="text-[9px] text-slate-400 font-bold">
                              ({p.unit})
                            </span>
                          </td>
                          <td className="p-6 text-center">
                            <input
                              type="number"
                              step="0.01"
                              className="w-24 p-2 rounded-xl text-center border border-slate-200 bg-white text-slate-900"
                              value={p.raw}
                              onChange={(e) => {
                                const newParams = [...params];
                                newParams[idx].raw = e.target.value;
                                setParams(newParams);
                              }}
                            />
                          </td>
                          <td className="p-6 text-center">
                            <input
                              type="number"
                              step="0.01"
                              className="w-24 p-2 rounded-xl text-center font-black border border-slate-200 bg-white text-slate-900"
                              value={p.treated}
                              onChange={(e) => {
                                const newParams = [...params];
                                newParams[idx].treated = e.target.value;
                                setParams(newParams);
                              }}
                            />
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-4">
                              <span className="text-[10px] text-slate-400 font-black tracking-widest">
                                INEN: {p.limit}
                              </span>
                              <div
                                className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                                  status === "ok"
                                    ? "bg-success-green shadow-[0_0_10px_#10b981]"
                                    : status === "fail"
                                      ? "bg-danger-red shadow-[0_0_10px_#ef4444]"
                                      : "bg-slate-200"
                                }`}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Compliance indicator */}
              <div className="mt-10 p-8 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Indicador de Cumplimiento Global
                  </h4>
                  <p className="text-xs text-slate-500 font-medium italic">
                    Evaluación porcentual instantánea contra límites máximos
                    permitidos.
                  </p>
                </div>
                <ComplianceGauge percentage={compliance} />
              </div>
            </section>

            {/* 03. Dosificación */}
            <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 card-shadow">
              <SectionHeader number="03" title="Ingeniería de Procesos y Stock" />
              <div className="space-y-4">
                {dosageRows.map((row, idx) => {
                  const result = getDoseResult(row);
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-1 md:grid-cols-6 gap-6 p-8 bg-slate-50 rounded-[2rem] border border-slate-200 relative shadow-inner"
                    >
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDosageRows((rows) =>
                              rows.filter((r) => r.id !== row.id)
                            )
                          }
                          className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full w-10 h-10 text-[12px] font-black shadow-2xl hover:scale-110 transition-transform"
                        >
                          ×
                        </button>
                      )}
                      <div className="md:col-span-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block ml-1">
                          Insumo Químico
                        </label>
                        <select
                          className="w-full p-4 rounded-xl text-xs font-black border border-slate-200 uppercase bg-white text-slate-900"
                          value={row.product}
                          onChange={(e) => {
                            const newRows = [...dosageRows];
                            newRows[idx].product = e.target.value;
                            setDosageRows(newRows);
                          }}
                        >
                          {CHEMICAL_PRODUCTS.map((cp) => (
                            <option key={cp.value} value={cp.value}>
                              {cp.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block ml-1">
                          mL/min
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full p-4 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-900"
                          value={row.mlMin}
                          onChange={(e) => {
                            const newRows = [...dosageRows];
                            newRows[idx].mlMin = e.target.value;
                            setDosageRows(newRows);
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block ml-1">
                          Conc (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full p-4 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-900"
                          value={row.concPct}
                          onChange={(e) => {
                            const newRows = [...dosageRows];
                            newRows[idx].concPct = e.target.value;
                            setDosageRows(newRows);
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block ml-1">
                          Stock (Kg)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full p-4 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-900"
                          value={row.stockKg}
                          onChange={(e) => {
                            const newRows = [...dosageRows];
                            newRows[idx].stockKg = e.target.value;
                            setDosageRows(newRows);
                          }}
                        />
                      </div>
                      <div className="bg-navy-blue rounded-2xl p-4 text-white text-center flex flex-col justify-center shadow-xl">
                        <p className="text-[10px] font-bold uppercase opacity-50">
                          Dosis mg/L
                        </p>
                        <p className="text-2xl font-black leading-none">
                          {result.dose}
                        </p>
                        <p className="text-[10px] text-cyan-400 font-black uppercase mt-2">
                          Días: {result.days}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() =>
                  setDosageRows((rows) => [
                    ...rows,
                    {
                      id: Date.now(),
                      product: "PAC",
                      mlMin: "",
                      concPct: "",
                      stockKg: "",
                    },
                  ])
                }
                className="mt-6 text-navy-blue text-[10px] font-black uppercase tracking-widest hover:underline"
              >
                + Adicionar Fila Operativa
              </button>
            </section>

            {/* 04. Observaciones */}
            <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 card-shadow">
              <div className="border-b border-slate-100 pb-6 mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-navy-blue rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-900/20">
                    04
                  </div>
                  <h3 className="text-navy-blue text-sm font-black uppercase tracking-widest">
                    Observaciones de Ingeniería
                  </h3>
                </div>
                <AiButton
                  onClick={handleAiTech}
                  loading={loadingTech}
                  label="Diagnóstico"
                />
              </div>
              <textarea
                rows={4}
                className="w-full p-6 rounded-2xl text-sm border border-slate-200 bg-white text-slate-900 focus:border-navy-blue focus:outline-none focus:ring-4 focus:ring-navy-blue/[0.08]"
                placeholder="Hallazgos técnicos y recomendaciones de operación..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </section>
          </div>
        )}

        {/* GESTIÓN COMERCIAL */}
        {activeTab === "comercial" && (
          <div className="space-y-10 fade-in">
            <section className="bg-white p-10 rounded-[2.5rem] border-l-[15px] border-gold-comercial card-shadow">
              <div className="border-b border-slate-100 pb-6 mb-8 flex justify-between items-center">
                <h3 className="text-navy-blue text-sm font-black uppercase tracking-widest text-gold-comercial">
                  Análisis de Mercado
                </h3>
                <AiButton
                  onClick={handleAiCom}
                  loading={loadingCom}
                  label="Estrategia"
                  variant="amber"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">
                    Productos que consumen actualmente:
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      "Coagulantes",
                      "Desinfectantes",
                      "Floculantes",
                      "Ajuste pH",
                    ].map((prod) => (
                      <label
                        key={prod}
                        className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm cursor-pointer border border-transparent hover:border-navy-blue transition-all"
                      >
                        <span className="text-xs font-bold text-slate-700">
                          {prod === "Coagulantes"
                            ? "Coagulantes (PAC/Sulfato)"
                            : prod === "Desinfectantes"
                              ? "Desinfectantes (Cloro/Hipoclorito)"
                              : prod === "Floculantes"
                                ? "Polímeros / Floculantes"
                                : "Ajuste de pH (Cal/Soda)"}
                        </span>
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded text-navy-blue"
                          checked={marketProducts.includes(prod)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMarketProducts((prev) => [...prev, prod]);
                            } else {
                              setMarketProducts((prev) =>
                                prev.filter((p) => p !== prod)
                              );
                            }
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <InputField
                    label="Proveedor Actual de la Competencia"
                    value={comProveedor}
                    onChange={(e) => setComProveedor(e.target.value)}
                    placeholder="Nombre de la empresa"
                    className="uppercase"
                  />
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">
                      Modalidad de Adquisición
                    </label>
                    <select
                      className="w-full p-4 rounded-xl font-bold border border-slate-200 bg-white text-slate-900"
                      value={comAdquisicion}
                      onChange={(e) => setComAdquisicion(e.target.value)}
                    >
                      <option value="Compra Directa">Compra Directa</option>
                      <option value="Portal Compras">
                        Portal de Compras Públicas (SERCOP)
                      </option>
                      <option value="Licitación">
                        Licitación de Suministros
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">
                      Tipo de Contratación
                    </label>
                    <select
                      className="w-full p-4 rounded-xl font-bold border border-slate-200 bg-white text-slate-900"
                      value={comContratacion}
                      onChange={(e) => setComContratacion(e.target.value)}
                    >
                      <option value="Ínfima Cuantía">Ínfima Cuantía</option>
                      <option value="Subasta Inversa">
                        Subasta Inversa Electrónica
                      </option>
                      <option value="Menor Cuantía">Menor Cuantía</option>
                    </select>
                  </div>
                  <InputField
                    label="Fecha Próxima Compra"
                    type="date"
                    value={comFechaCompra}
                    onChange={(e) => setComFechaCompra(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2 pt-6 border-t border-slate-100">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">
                    Comentarios y Sugerencia IA
                  </label>
                  <textarea
                    rows={3}
                    className="w-full p-5 rounded-2xl text-sm border border-gold-comercial/30 font-medium bg-white text-slate-900"
                    placeholder="Estrategia de negociación..."
                    value={comComentarios}
                    onChange={(e) => setComComentarios(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Cotizador */}
            {tipoCliente === "POTENCIAL" && (
              <section className="bg-white p-10 rounded-[2.5rem] border-l-[15px] border-success-green card-shadow">
                <div className="border-b border-slate-100 pb-6 mb-8">
                  <h3 className="text-navy-blue text-sm font-black uppercase tracking-widest text-success-green">
                    Generador de Propuesta Económica
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 uppercase font-black border-b text-left">
                        <th className="p-4">Descripción del Insumo</th>
                        <th className="p-4 text-center">Cant. Propuesta</th>
                        <th className="p-4 text-center">P. Unitario ($)</th>
                        <th className="p-4 text-right">Subtotal</th>
                        <th className="p-4 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {quoteRows.map((row, idx) => {
                        const rowTotal =
                          (parseFloat(row.qty) || 0) *
                          (parseFloat(row.price) || 0);
                        return (
                          <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-6">
                              <input
                                type="text"
                                className="w-full p-4 rounded-xl text-xs font-black uppercase border border-slate-200 bg-white text-slate-900"
                                placeholder="Insumo"
                                value={row.prod}
                                onChange={(e) => {
                                  const newRows = [...quoteRows];
                                  newRows[idx].prod = e.target.value;
                                  setQuoteRows(newRows);
                                }}
                              />
                            </td>
                            <td className="p-6">
                              <input
                                type="number"
                                className="w-full p-4 rounded-xl text-xs text-center font-black border border-slate-200 bg-white text-slate-900"
                                value={row.qty}
                                onChange={(e) => {
                                  const newRows = [...quoteRows];
                                  newRows[idx].qty = e.target.value;
                                  setQuoteRows(newRows);
                                }}
                              />
                            </td>
                            <td className="p-6">
                              <input
                                type="number"
                                step="0.01"
                                className="w-full p-4 rounded-xl text-xs text-center font-black border border-slate-200 bg-white text-slate-900"
                                value={row.price}
                                onChange={(e) => {
                                  const newRows = [...quoteRows];
                                  newRows[idx].price = e.target.value;
                                  setQuoteRows(newRows);
                                }}
                              />
                            </td>
                            <td className="p-6 text-right font-black text-navy-blue text-lg">
                              ${rowTotal.toFixed(2)}
                            </td>
                            <td className="p-6 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuoteRows((rows) =>
                                    rows.filter((r) => r.id !== row.id)
                                  )
                                }
                                className="text-red-400 scale-125 font-black"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setQuoteRows((rows) => [
                      ...rows,
                      { id: Date.now(), prod: "", qty: "0", price: "0" },
                    ])
                  }
                  className="mt-6 text-[10px] font-black uppercase text-success-green hover:underline tracking-widest"
                >
                  + Proponer Nuevo Item
                </button>

                <div className="mt-12 flex justify-end">
                  <div className="w-80 space-y-4 p-8 bg-slate-50 rounded-[2rem] border border-slate-200">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                      <span>Subtotal:</span>
                      <span>${quoteSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 font-bold uppercase tracking-widest">
                      <span>IVA (15%):</span>
                      <span>${quoteTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-2xl text-navy-blue font-black border-t-2 border-navy-blue/20 pt-4 mt-2">
                      <span>TOTAL:</span>
                      <span>${quoteTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* ARCHIVO CENTRAL */}
        {activeTab === "historial" && (
          <div className="space-y-16 fade-in">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div>
                <h2 className="text-4xl font-black text-navy-blue uppercase tracking-tighter leading-none">
                  Archivo Central
                </h2>
                <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em] mt-3">
                  Base de datos de gestión técnica y prospectos.
                </p>
              </div>
              <div className="flex gap-4">
                <button onClick={exportCarteraExcel} className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-700 transition shadow-xl tracking-widest">
                  Excel Cartera Técnica
                </button>
                <button onClick={exportProspectosExcel} className="bg-amber-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-amber-600 transition shadow-xl tracking-widest">
                  Excel Prospectos
                </button>
              </div>
            </div>

            {/* Buscador */}
            <div className="relative max-w-xl">
              <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                placeholder="Buscar por institución, provincia..."
                className="w-full rounded-2xl py-3.5 pl-12 pr-6 text-slate-900 placeholder-slate-400 border border-slate-200 focus:outline-none focus:border-blue-500 transition-all bg-white shadow-sm"
              />
            </div>

            <div className="space-y-14">
              <div>
                <h3 className="text-[11px] font-black text-slate-400 uppercase mb-6 border-b pb-4 flex items-center gap-3">
                  <span className="w-4 h-4 bg-blue-500 rounded-full shadow-lg" />
                  Cartera de Clientes (Seguimiento Técnico)
                </h3>
                <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 font-black border-b">
                      <tr>
                        <th className="p-8">Fecha</th>
                        <th className="p-8">Institución</th>
                        <th className="p-8">Ubicación</th>
                        <th className="p-8 text-center">Cumplimiento %</th>
                        <th className="p-8 text-center">Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {filteredCartera.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 italic text-xs">
                            No hay registros de cartera.
                          </td>
                        </tr>
                      ) : (
                        filteredCartera.map((v: NonNullable<typeof allVisitas>[number]) => (
                          <tr key={v._id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-6 font-mono text-xs text-slate-500">{new Date(v._creationTime).toLocaleDateString("es-EC")}</td>
                            <td className="p-6 font-black text-navy-blue">{v.org}</td>
                            <td className="p-6 text-slate-600">{v.provincia ?? "—"} — {v.canton ?? ""}</td>
                            <td className="p-6 text-center">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${(v.compliance ?? 0) >= 80 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {v.compliance ?? 0}%
                              </span>
                            </td>
                            <td className="p-6 text-center">
                              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase">Activo</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-black text-gold-comercial uppercase mb-6 border-b border-gold-comercial/30 pb-4 flex items-center gap-3">
                  <span className="w-4 h-4 bg-gold-comercial rounded-full shadow-lg" />
                  Pipeline Comercial (Ventas)
                </h3>
                <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 font-black border-b">
                      <tr>
                        <th className="p-8">Fecha</th>
                        <th className="p-8">Prospecto</th>
                        <th className="p-8">Provincia</th>
                        <th className="p-8 text-center">Total Ofertado</th>
                        <th className="p-8 text-center">Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      {filteredProspectos.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 italic text-xs">
                            No hay prospectos registrados.
                          </td>
                        </tr>
                      ) : (
                        filteredProspectos.map((v: NonNullable<typeof allVisitas>[number]) => (
                          <tr key={v._id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-6 font-mono text-xs text-slate-500">{new Date(v._creationTime).toLocaleDateString("es-EC")}</td>
                            <td className="p-6 font-black text-navy-blue">{v.org}</td>
                            <td className="p-6 text-slate-600">{v.provincia ?? "—"}</td>
                            <td className="p-6 text-center font-black text-gold-comercial">{v.comercial?.totalQuote ? `$ ${v.comercial.totalQuote}` : "—"}</td>
                            <td className="p-6 text-center">
                              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase">Prospecto</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/[0.98] backdrop-blur-lg border-t border-slate-200 p-5 z-[100] shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-navy-blue rounded-2xl flex items-center justify-center text-white shadow-xl rotate-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className={`text-[11px] font-black uppercase tracking-[0.3em] ${tipoCliente === "POTENCIAL" ? "text-gold-comercial" : "text-navy-blue opacity-60"}`}>
                {tipoCliente === "POTENCIAL"
                  ? "Prospecto Comercial: Oferta de Suministros"
                  : "Cliente Cartera: Ingeniería Aplicada"}
              </p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Seguimiento de Ingeniería Terminado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFinalize}
            className="w-full md:w-auto bg-navy-blue text-white px-20 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.4em] hover:bg-slate-800 shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 border-b-4 border-black"
          >
            Finalizar y Generar Documentos
          </button>
        </div>
      </div>
    </div>
  );
}
