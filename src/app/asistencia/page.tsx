"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  QrCode,
  FileText,
  Trash2,
  Search,
  X,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InputField } from "@/components/ui/InputField";
import { SelectField } from "@/components/ui/SelectField";
import { ComplianceGauge } from "@/components/ui/ComplianceGauge";
import { AiButton } from "@/components/ai/AiButton";
import { useToast } from "@/hooks/useToast";
import { useGemini } from "@/hooks/useGemini";
import { useSafeMutation, useSafeQuery } from "@/hooks/useConvex";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { exportToExcel } from "@/lib/export/excel";
import {
  ALL,
  GROUPS,
  PMAP,
  POINT_LABEL,
  evalParam,
  limText,
  limitsFor,
  normName,
  type Param,
  type SamplePoint,
} from "@/lib/calidad-agua/norma";
import { computeSpc } from "@/lib/calidad-agua/spc";
import { computeLSI, computeNIndex } from "@/lib/calidad-agua/indices";
import { buildCertificadoHTML, buildCertificadoRows } from "@/lib/export/certificadoCalidadAgua";

interface WaterQualityTestDoc {
  _id: Id<"waterQualityTests">;
  _creationTime: number;
  code: string;
  point: SamplePoint;
  planta?: string;
  operador?: string;
  sector?: string;
  provincia?: string;
  canton?: string;
  caudal?: number;
  fecha: string;
  hora?: string;
  analista?: string;
  responsable?: string;
  metodo?: string;
  calibracion?: string;
  certificado?: string;
  producto?: string;
  diagnostico?: string;
  results: Record<string, string>;
  pct: number;
  fail: number;
}

interface CapaDoc {
  _id: Id<"waterQualityCapaActions">;
  testId: Id<"waterQualityTests">;
  paramKey: string;
  categoria6M?: string;
  porques?: string;
  accion?: string;
  responsable?: string;
  estado: "Abierta" | "En proceso" | "Cerrada" | "Verificada";
}

type TabKey = "registro" | "spc" | "capa" | "archivo";

const TABS: { key: TabKey; label: string }[] = [
  { key: "registro", label: "01 · Registro de Ensayo" },
  { key: "spc", label: "02 · Control Estadístico" },
  { key: "capa", label: "03 · No Conformidades" },
  { key: "archivo", label: "04 · Archivo & Reportes" },
];

const CAUSA_6M = [
  "Método",
  "Mano de obra",
  "Material / Insumo",
  "Maquinaria / Equipo",
  "Medio ambiente",
  "Medición",
];
const ESTADOS_CAPA = ["Abierta", "En proceso", "Cerrada", "Verificada"] as const;

interface CustodyForm {
  planta: string;
  operador: string;
  sector: string;
  provincia: string;
  canton: string;
  caudal: string;
  fecha: string;
  hora: string;
  analista: string;
  responsable: string;
  metodo: string;
  calibracion: string;
  certificado: string;
  producto: string;
}

function todayCustody(): CustodyForm {
  const now = new Date();
  return {
    planta: "",
    operador: "",
    sector: "",
    provincia: "",
    canton: "",
    caudal: "",
    fecha: now.toISOString().slice(0, 10),
    hora: now.toTimeString().slice(0, 5),
    analista: "",
    responsable: "",
    metodo: "",
    calibracion: "Vigente",
    certificado: "",
    producto: "",
  };
}

function generateCode(point: SamplePoint, custody: CustodyForm): string {
  const d = (custody.fecha || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const h = (custody.hora || "").replace(":", "") || new Date().toTimeString().slice(0, 5).replace(":", "");
  const norm = (s: string) => {
    const n = (s || "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return (n[0] || "X").toUpperCase();
  };
  return `${norm(custody.provincia)}${norm(custody.canton)}-${point}-${d}-${h}`;
}

function computeCompliance(results: Record<string, string>, point: SamplePoint) {
  let evald = 0;
  let fail = 0;
  for (const p of ALL) {
    const raw = results[p.k];
    if (raw == null || raw === "") continue;
    const st = evalParam(p, raw, point);
    if (st === "ok" || st === "bad") evald++;
    if (st === "bad") fail++;
  }
  const pct = evald > 0 ? Math.round(((evald - fail) / evald) * 100) : 100;
  return { pct, evald, fail };
}

function numFromResults(results: Record<string, string>, key: string): number | null {
  const v = results[key];
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function displayResultValue(p: Param, raw: string): string {
  if (p.type === "micro") return raw === "0" ? "Ausencia" : "Presencia";
  if (p.type === "org") return raw === "0" ? "No objetable" : "Objetable";
  return raw;
}

function verifyUrl(code: string, id: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/asistencia?verify=${encodeURIComponent(code)}&id=${encodeURIComponent(id)}`;
}

function buildDiagnosisPrompt(
  point: SamplePoint,
  results: Record<string, string>,
  custody: CustodyForm,
  evalRes: { pct: number; fail: number }
): string {
  const detail = ALL.filter((p) => results[p.k] != null && results[p.k] !== "")
    .map((p) => {
      const st = evalParam(p, results[p.k], point);
      const v = displayResultValue(p, results[p.k]);
      const lim = limText(p, point);
      return `${p.n}: ${v} ${p.u} (límite ${lim}) -> ${st === "bad" ? "NO CUMPLE" : st === "ok" ? "cumple" : "-"}`;
    })
    .join("\n");

  let roleCtx: string;
  let task: string;
  if (point === "SALIDA") {
    roleCtx = "La muestra es AGUA TRATADA (efluente final del tren de tratamiento), destinada al consumo humano.";
    task =
      "Evalúa la CONFORMIDAD frente a NTE INEN 1108:2020. Interpreta cada desviación y su causa probable en el tren (coagulación, floculación, sedimentación, filtración, desinfección) y entrega 2-3 acciones correctivas concretas. Si todo cumple, confírmalo como agua apta y sugiere acciones de verificación/control.";
  } else if (point === "CRUDA") {
    roleCtx = `La muestra es AGUA CRUDA (captación, antes de tratar), evaluada frente a TULSMA Anexo 1 Tabla 1 (criterios de calidad de aguas para consumo humano y doméstico que requieren tratamiento convencional). Producto/coagulante que emplea la planta: ${custody.producto || "no especificado"}.`;
    task =
      "Realiza un ANÁLISIS DE TRATABILIDAD: clasifica la calidad de la fuente frente a TULSMA Tabla 1 (¿es tratable por tren convencional o excede los criterios?), identifica los parámetros que condicionan el tratamiento (turbiedad, color, dureza, metales, materia orgánica) y recomienda el esquema y una dosificación aproximada usando el producto/coagulante indicado (o el más adecuado si no se especifica). NO apliques INEN 1108 como criterio de aprobación; úsala solo como meta del agua tratada de salida.";
  } else {
    roleCtx = "La muestra proviene de la RED DE DISTRIBUCIÓN (agua que ya consume la población).";
    task =
      "Evalúa la calidad del agua de consumo frente a NTE INEN 1108:2020, con énfasis en cloro residual libre (barrera de desinfección remanente en red), presencia microbiológica y estabilidad del agua. Interpreta el riesgo para la salud pública y entrega 2-3 acciones concretas (purga de red, refuerzo de cloración, investigación de contaminación/intrusión).";
  }

  return `${roleCtx}\nPunto de muestreo: ${POINT_LABEL[point]}. Norma de referencia: ${normName(point)}. Planta: ${custody.planta || "N/D"}.\nResultados analíticos:\n${detail}\nCumplimiento global: ${evalRes.pct}% (${evalRes.fail} no conformidades).\n\nComo ingeniero sanitario y responsable de un sistema de gestión de calidad, ${task} Máximo 140 palabras, técnico, conciso y accionable.`;
}

export default function CalidadAguaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ConsolaCalidadAguaContent />
    </Suspense>
  );
}

function ConsolaCalidadAguaContent() {
  const { toast, showToast } = useToast();
  const searchParams = useSearchParams();
  const verifyCode = searchParams.get("verify");
  const verifyId = searchParams.get("id");

  const [activeTab, setActiveTab] = useState<TabKey>("registro");
  const [currentPoint, setCurrentPoint] = useState<SamplePoint>("SALIDA");
  const [custody, setCustody] = useState<CustodyForm>(() => todayCustody());
  const [results, setResults] = useState<Record<string, string>>({});
  const [diagnostico, setDiagnostico] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [archiveSearch, setArchiveSearch] = useState("");
  const [spcPoint, setSpcPoint] = useState<SamplePoint>("SALIDA");
  const spcOptions = useMemo(() => ALL.filter((p) => p.spc || (p.max != null && !p.type)), []);
  const [spcParamKey, setSpcParamKey] = useState<string>(spcOptions[0]?.k ?? "turb");
  const [qrTarget, setQrTarget] = useState<{ test: WaterQualityTestDoc; dataUrl: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WaterQualityTestDoc | null>(null);

  const allTestsRaw = useSafeQuery(api.waterQualityTests.getAll);
  const allTests = useMemo(() => (allTestsRaw ?? []) as WaterQualityTestDoc[], [allTestsRaw]);
  const capaRowsRaw = useSafeQuery(api.waterQualityCapa.getAll);
  const capaRows = useMemo(() => (capaRowsRaw ?? []) as CapaDoc[], [capaRowsRaw]);

  const createTest = useSafeMutation(api.waterQualityTests.create);
  const removeTest = useSafeMutation(api.waterQualityTests.remove);
  const createBitacora = useSafeMutation(api.bitacoraEntries.create);
  const upsertCapa = useSafeMutation(api.waterQualityCapa.upsert);

  const verifyResultRaw = useSafeQuery(
    api.waterQualityTests.getForVerify,
    verifyCode || verifyId ? { code: verifyCode ?? undefined, id: (verifyId as Id<"waterQualityTests">) ?? undefined } : "skip"
  );

  const { generate: generateDiagnosis, loading: loadingDiagnosis } = useGemini({ context: "calidad-agua-diagnostico" });

  const code = useMemo(() => generateCode(currentPoint, custody), [currentPoint, custody]);
  const compliance = useMemo(() => computeCompliance(results, currentPoint), [results, currentPoint]);
  const lsi = useMemo(
    () =>
      computeLSI({
        ph: numFromResults(results, "ph"),
        temp: numFromResults(results, "temp"),
        sdt: numFromResults(results, "sdt"),
        dureza: numFromResults(results, "dureza"),
        alcal: numFromResults(results, "alcal"),
      }),
    [results]
  );
  const nIndex = useMemo(
    () => computeNIndex(numFromResults(results, "no3"), numFromResults(results, "no2")),
    [results]
  );

  const updateResult = useCallback((key: string, value: string) => {
    setResults((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleGroup = (gi: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gi)) next.delete(gi);
      else next.add(gi);
      return next;
    });
  };

  const handleDiagnosis = async () => {
    if (compliance.evald === 0) {
      showToast("Ingrese resultados antes del diagnóstico", "error");
      return;
    }
    const prompt = buildDiagnosisPrompt(currentPoint, results, custody, compliance);
    const result = await generateDiagnosis(prompt);
    if (result) {
      setDiagnostico(result);
      showToast("Diagnóstico generado", "success");
    } else {
      showToast("No se pudo conectar con la IA", "error");
    }
  };

  const handleSave = async () => {
    const filledCount = Object.values(results).filter((v) => v !== "").length;
    if (filledCount === 0) {
      showToast("Ingrese al menos un resultado", "error");
      return;
    }
    try {
      await createTest({
        code,
        point: currentPoint,
        planta: custody.planta || undefined,
        operador: custody.operador || undefined,
        sector: custody.sector || undefined,
        provincia: custody.provincia || undefined,
        canton: custody.canton || undefined,
        caudal: custody.caudal ? parseFloat(custody.caudal) : undefined,
        fecha: custody.fecha || new Date().toISOString().slice(0, 10),
        hora: custody.hora || undefined,
        analista: custody.analista || undefined,
        responsable: custody.responsable || undefined,
        metodo: custody.metodo || undefined,
        calibracion: custody.calibracion || undefined,
        certificado: custody.certificado || undefined,
        producto: custody.producto || undefined,
        diagnostico: diagnostico || undefined,
        results,
        pct: compliance.pct,
        fail: compliance.fail,
      });
      await createBitacora({
        date: custody.fecha || new Date().toISOString().slice(0, 10),
        source: "Consola de Calidad de Agua",
        category: "Calidad de Agua",
        summary: `Ensayo ${POINT_LABEL[currentPoint]} — ${custody.planta || "N/D"} — Cumplimiento: ${compliance.pct}%`,
      });
      showToast("Ensayo registrado correctamente", "success");
      setResults({});
      setDiagnostico("");
      setCustody((c) => ({ ...c, sector: "" }));
    } catch (err) {
      console.error("Error al guardar ensayo:", err);
      showToast("Error al guardar — revise conexión", "error");
    }
  };

  const handleShowQr = async (test: WaterQualityTestDoc) => {
    try {
      const url = verifyUrl(test.code, test._id);
      const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });
      setQrTarget({ test, dataUrl });
    } catch (err) {
      console.error(err);
      showToast("No se pudo generar el QR", "error");
    }
  };

  const handlePrint = async (test: WaterQualityTestDoc) => {
    try {
      const url = verifyUrl(test.code, test._id);
      const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });
      const html = buildCertificadoHTML({ ...test, qrDataUrl, verifyUrl: url });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const w = window.open(blobUrl, "_blank", "noopener,noreferrer");
      if (w) setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch (err) {
      console.error(err);
      showToast("No se pudo generar el certificado", "error");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeTest({ id: deleteTarget._id });
      showToast("Ensayo eliminado", "success");
    } catch {
      showToast("No se pudo eliminar", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExportExcel = () => {
    if (allTests.length === 0) {
      showToast("No hay ensayos para exportar", "error");
      return;
    }
    const rows = allTests.map((t) => {
      const base: Record<string, unknown> = {
        Código: t.code,
        Fecha: t.fecha,
        Hora: t.hora ?? "",
        Punto: POINT_LABEL[t.point],
        Planta: t.planta ?? "",
        Operador: t.operador ?? "",
        Sector: t.sector ?? "",
        Provincia: t.provincia ?? "",
        Cantón: t.canton ?? "",
        Caudal: t.caudal ?? "",
        Analista: t.analista ?? "",
        Responsable: t.responsable ?? "",
        Método: t.metodo ?? "",
        Calibración: t.calibracion ?? "",
        "Cert. Calibración": t.certificado ?? "",
        "Cumplimiento %": t.pct,
        Dictamen: t.fail === 0 ? "Conforme" : "No conforme",
      };
      for (const p of ALL) {
        const v = t.results[p.k];
        base[`${p.n} (${p.u})`] = v == null || v === "" ? "" : displayResultValue(p, v);
      }
      return base;
    });
    exportToExcel(rows, "Historico Calidad Agua", `Historico_Calidad_INEN1108_${new Date().toISOString().slice(0, 10)}`);
    showToast("Histórico exportado", "success");
  };

  // ── No conformidades (CAPA), derivadas de todos los ensayos ──────────────
  const ncRows = useMemo(() => {
    const out: { id: string; testId: Id<"waterQualityTests">; paramKey: string; param: Param; code: string; fecha: string; point: SamplePoint; planta?: string; val: string; lim: string }[] = [];
    for (const t of allTests) {
      for (const key of Object.keys(t.results)) {
        const p = PMAP[key];
        if (!p) continue;
        if (evalParam(p, t.results[key], t.point) === "bad") {
          out.push({
            id: `${t._id}__${key}`,
            testId: t._id,
            paramKey: key,
            param: p,
            code: t.code,
            fecha: t.fecha,
            point: t.point,
            planta: t.planta,
            val: displayResultValue(p, t.results[key]),
            lim: limText(p, t.point),
          });
        }
      }
    }
    return out;
  }, [allTests]);

  const capaMap = useMemo(() => {
    const m = new Map<string, CapaDoc>();
    for (const c of capaRows) m.set(`${c.testId}__${c.paramKey}`, c);
    return m;
  }, [capaRows]);

  const handleCapaField = async (
    testId: Id<"waterQualityTests">,
    paramKey: string,
    field: "categoria6M" | "porques" | "accion" | "responsable" | "estado",
    value: string
  ) => {
    const existing = capaMap.get(`${testId}__${paramKey}`);
    try {
      await upsertCapa({
        testId,
        paramKey,
        categoria6M: field === "categoria6M" ? value : existing?.categoria6M,
        porques: field === "porques" ? value : existing?.porques,
        accion: field === "accion" ? value : existing?.accion,
        responsable: field === "responsable" ? value : existing?.responsable,
        estado: (field === "estado" ? value : existing?.estado ?? "Abierta") as CapaDoc["estado"],
      });
    } catch (err) {
      console.error(err);
      showToast("No se pudo guardar la acción CAPA", "error");
    }
  };

  // ── SPC ────────────────────────────────────────────────────────────────
  const spcSeries = useMemo(() => {
    return allTests
      .filter((t) => t.point === spcPoint && t.results[spcParamKey] != null && t.results[spcParamKey] !== "")
      .map((t) => ({ label: t.code || t.fecha, value: parseFloat(t.results[spcParamKey]), ts: t._creationTime }))
      .filter((o) => !isNaN(o.value))
      .sort((a, b) => a.ts - b.ts);
  }, [allTests, spcPoint, spcParamKey]);

  const spcParam = PMAP[spcParamKey];
  const spcLimits = spcParam ? limitsFor(spcParam, spcPoint) : {};
  const spcUsl = spcLimits.usl ?? spcLimits.max;
  const spcLsl = spcLimits.lsl ?? spcLimits.min ?? 0;
  const spcResult = spcSeries.length >= 2 ? computeSpc(spcSeries, { usl: spcUsl, lsl: spcLsl }) : null;
  const spcChartData = spcSeries.map((s, i) => ({ idx: i + 1, value: s.value, label: s.label }));

  // ── Archivo ────────────────────────────────────────────────────────────
  const archiveFiltered = useMemo(() => {
    const q = archiveSearch.toLowerCase();
    if (!q) return allTests;
    return allTests.filter((t) => JSON.stringify(t).toLowerCase().includes(q));
  }, [allTests, archiveSearch]);

  const complianceByMonth = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    for (const t of allTests) {
      const m = (t.fecha || "").slice(0, 7);
      if (!m) continue;
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(t.pct ?? 100);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, vals]) => ({ month, pct: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) }));
  }, [allTests]);

  const ncByParam = useMemo(() => {
    const byParam = new Map<string, number>();
    for (const nc of ncRows) byParam.set(nc.param.n, (byParam.get(nc.param.n) ?? 0) + 1);
    return Array.from(byParam.entries()).map(([name, count]) => ({ name, count }));
  }, [ncRows]);

  const kpiTotal = allTests.length;
  const kpiCompliance = allTests.length ? Math.round(allTests.reduce((s, t) => s + (t.pct ?? 100), 0) / allTests.length) : null;
  const kpiLast = allTests[0]?.fecha ?? "—";

  const ncOpenClosed = useMemo(() => {
    let open = 0;
    let closed = 0;
    for (const nc of ncRows) {
      const estado = capaMap.get(nc.id)?.estado ?? "Abierta";
      if (estado === "Cerrada" || estado === "Verificada") closed++;
      else open++;
    }
    return { open, closed };
  }, [ncRows, capaMap]);

  // ── Verificación por QR (requiere sesión, como el resto de la plataforma) ─
  if (verifyCode || verifyId) {
    return (
      <AuthGuard permissionKey="canAccessAsistencia" moduleName="Consola de Calidad de Agua">
        <div className="min-h-screen bg-slate-50 text-slate-900">
          <div className="max-w-2xl mx-auto px-6 py-14">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-navy-blue text-white flex items-center justify-center font-black text-xs rounded-xl">H2O</div>
              <div>
                <p className="text-[9px] font-black tracking-[0.22em] uppercase text-slate-400">TERAH2O · Sistema de Gestión de Calidad</p>
                <p className="text-sm font-black text-navy-blue uppercase tracking-widest">Verificación de Certificado</p>
              </div>
            </div>
            {verifyResultRaw === undefined ? (
              <div className="bg-white rounded-3xl border border-slate-200 card-shadow p-10 text-center">
                <p className="text-sm font-black uppercase tracking-widest text-slate-400">Consultando registro…</p>
              </div>
            ) : verifyResultRaw === null ? (
              <div className="bg-white rounded-3xl border-t-4 border-amber-500 card-shadow p-10 text-center">
                <p className="text-xl font-black uppercase tracking-tight text-amber-600">Certificado no encontrado</p>
                <p className="text-[12px] text-slate-500 font-semibold mt-2 font-mono">{verifyCode || verifyId}</p>
                <p className="text-[12px] text-slate-500 font-semibold mt-2">No existe un ensayo con este código en la plataforma TeraH2O.</p>
              </div>
            ) : (
              (() => {
                const r = verifyResultRaw as { code: string; point: SamplePoint; planta?: string; provincia?: string; canton?: string; fecha?: string; hora?: string; analista?: string; responsable?: string; results: Record<string, string>; pct: number; fail: number };
                const ok = r.fail === 0;
                const rows = buildCertificadoRows({ ...r, code: r.code, point: r.point });
                return (
                  <>
                    <div className={`bg-white rounded-3xl card-shadow p-8 mb-6 border-t-4 ${ok ? "border-success-green" : "border-danger-red"}`}>
                      <div className="flex items-center gap-4 mb-2">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white ${ok ? "bg-success-green" : "bg-danger-red"}`}>
                          <ShieldCheck className="w-8 h-8" />
                        </div>
                        <div>
                          <p className={`text-2xl font-black uppercase tracking-tight ${ok ? "text-success-green" : "text-danger-red"}`}>Certificado Verificado</p>
                          <p className="text-[11px] font-bold text-slate-500 font-mono">{r.code}</p>
                        </div>
                      </div>
                      <p className="text-[12px] text-slate-600 font-semibold mt-3">
                        Este ensayo es <b>auténtico</b> y consta registrado en la plataforma TeraH2O. Dictamen global:{" "}
                        <b className={ok ? "text-success-green" : "text-danger-red"}>
                          {ok ? "AGUA APTA" : `NO CONFORME · ${r.fail} desviación(es)`} · {r.pct}% de cumplimiento ({normName(r.point)})
                        </b>
                        .
                      </p>
                    </div>
                    <div className="bg-white rounded-3xl card-shadow p-8">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12px] mb-6">
                        <div><span className="text-slate-400 font-bold">Planta:</span> <b>{r.planta || "—"}</b></div>
                        <div><span className="text-slate-400 font-bold">Punto:</span> <b>{POINT_LABEL[r.point]}</b></div>
                        <div><span className="text-slate-400 font-bold">Fecha / hora:</span> <b>{r.fecha || "—"} {r.hora || ""}</b></div>
                        <div><span className="text-slate-400 font-bold">Provincia / cantón:</span> <b>{r.provincia || "—"} / {r.canton || "—"}</b></div>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[9px] text-slate-400 uppercase tracking-widest border-b border-slate-200">
                            <th className="py-2 font-black">Parámetro</th>
                            <th className="py-2 font-black">Resultado</th>
                            <th className="py-2 font-black">Dictamen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.param.k} className="border-b border-slate-100">
                              <td className="py-2.5 pr-3 text-[12px] font-semibold">{row.param.n}</td>
                              <td className="py-2.5 px-2 font-mono text-center text-[12px] font-bold">{row.displayValue} {row.param.u}</td>
                              <td className={`py-2.5 pl-2 text-center text-[10px] font-black tracking-widest ${row.dictamen === "CUMPLE" ? "text-success-green" : row.dictamen === "NO CUMPLE" ? "text-danger-red" : "text-slate-400"}`}>{row.dictamen}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()
            )}
            <Link href="/asistencia" className="block text-center mt-8 text-[10px] font-black uppercase tracking-widest text-navy-blue hover:underline">
              Volver a la consola
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard permissionKey="canAccessAsistencia" moduleName="Consola de Calidad de Agua">
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
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
                  TERAH2O · SISTEMA DE GESTIÓN DE CALIDAD
                </span>
              </div>
              <NavbarUser />
            </div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none">
              Consola de Vigilancia de Calidad del Agua
            </h1>
            <p className="text-blue-200 mt-3 text-lg font-light">
              Monitoreo del agua de salida del tren de tratamiento · <span className="font-semibold text-cyan-300">NTE INEN 1108:2020</span>
            </p>
          </div>
        </header>

        {/* Tabs */}
        <nav className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto flex overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all ${
                  activeTab === t.key ? "tab-active" : "opacity-40"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        <main className="max-w-7xl mx-auto p-6 md:p-10">
          {/* ============ TAB 1: REGISTRO ============ */}
          {activeTab === "registro" && (
            <div className="space-y-10 fade-in">
              {/* Cadena de custodia */}
              <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 card-shadow">
                <div className="border-b border-slate-100 pb-6 mb-8 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-navy-blue rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-900/20 text-[11px]">
                      CC
                    </div>
                    <div>
                      <h3 className="text-navy-blue text-sm font-black uppercase tracking-widest">Cadena de Custodia &amp; Trazabilidad</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Identificación de la muestra, punto y responsables</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Código de muestra</p>
                    <p className="font-mono text-sm font-bold text-navy-blue">{code}</p>
                  </div>
                </div>

                <div className="mb-7">
                  <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Punto de muestreo (origen)</label>
                  <div className="grid grid-cols-3 gap-0 max-w-xl border border-slate-200 rounded-xl overflow-hidden">
                    {(["SALIDA", "CRUDA", "RED"] as SamplePoint[]).map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setCurrentPoint(pt)}
                        className={`p-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                          currentPoint === pt ? "bg-navy-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {POINT_LABEL[pt]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-2">
                    <InputField label="Planta / Sistema de tratamiento" value={custody.planta} onChange={(e) => setCustody((c) => ({ ...c, planta: e.target.value }))} placeholder="Ej: PTAP Central" />
                  </div>
                  <InputField label="GAD / Operador" value={custody.operador} onChange={(e) => setCustody((c) => ({ ...c, operador: e.target.value }))} />
                  <InputField label="Punto / Sector específico" value={custody.sector} onChange={(e) => setCustody((c) => ({ ...c, sector: e.target.value }))} placeholder="Ej: Tanque de reserva" />
                  <InputField label="Provincia" value={custody.provincia} onChange={(e) => setCustody((c) => ({ ...c, provincia: e.target.value }))} />
                  <InputField label="Cantón / Ciudad" value={custody.canton} onChange={(e) => setCustody((c) => ({ ...c, canton: e.target.value }))} />
                  <InputField label="Caudal (L/s)" type="number" step="0.01" value={custody.caudal} onChange={(e) => setCustody((c) => ({ ...c, caudal: e.target.value }))} className="font-black text-navy-blue" />
                  <InputField label="Fecha de muestreo" type="date" value={custody.fecha} onChange={(e) => setCustody((c) => ({ ...c, fecha: e.target.value }))} />
                  <InputField label="Hora" type="time" value={custody.hora} onChange={(e) => setCustody((c) => ({ ...c, hora: e.target.value }))} className="font-mono" />
                  <InputField label="Analista de laboratorio" value={custody.analista} onChange={(e) => setCustody((c) => ({ ...c, analista: e.target.value }))} />
                  <InputField label="Responsable de calidad" value={custody.responsable} onChange={(e) => setCustody((c) => ({ ...c, responsable: e.target.value }))} />
                  <InputField label="Método / Equipo" value={custody.metodo} onChange={(e) => setCustody((c) => ({ ...c, metodo: e.target.value }))} placeholder="Ej: Espectrofotómetro HACH" />
                  <SelectField
                    label="Estado de calibración"
                    value={custody.calibracion}
                    onChange={(e) => setCustody((c) => ({ ...c, calibracion: e.target.value }))}
                    options={[
                      { value: "Vigente", label: "Vigente" },
                      { value: "Próx. a vencer", label: "Próxima a vencer" },
                      { value: "Vencida", label: "Vencida" },
                      { value: "N/A", label: "No aplica" },
                    ]}
                  />
                  <InputField label="Código de certificado de calibración" value={custody.certificado} onChange={(e) => setCustody((c) => ({ ...c, certificado: e.target.value }))} className="font-mono" placeholder="Opcional" />
                  <div className="md:col-span-2">
                    <InputField label="Producto químico / coagulante de la planta" value={custody.producto} onChange={(e) => setCustody((c) => ({ ...c, producto: e.target.value }))} placeholder="Ej: Sulfato de aluminio, PAC, hipoclorito de calcio…" />
                  </div>
                </div>
              </section>

              {/* Parámetros */}
              <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 card-shadow">
                <div className="border-b border-slate-100 pb-6 mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-navy-blue text-sm font-black uppercase tracking-widest">
                      Resultados Analíticos · <span>{normName(currentPoint)}</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      {currentPoint === "CRUDA"
                        ? "Agua cruda: evaluada como agua A TRATAR según TULSMA Anexo 1, Tabla 1 (tratamiento convencional) — no como agua potable"
                        : "Validación instantánea contra NTE INEN 1108:2020 (agua para consumo humano)"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCollapsedGroups(new Set())} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-navy-blue">
                      Expandir
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setCollapsedGroups(new Set(GROUPS.map((_, i) => i)))}
                      className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-navy-blue"
                    >
                      Colapsar
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {GROUPS.map((grp, gi) => {
                    const collapsed = collapsedGroups.has(gi);
                    return (
                      <div key={grp.g} className="border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleGroup(gi)}
                          className="w-full flex items-center justify-between bg-slate-50 px-5 py-3"
                        >
                          <span className="text-[11px] font-black text-navy-blue uppercase tracking-widest">{grp.g}</span>
                          {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                        </button>
                        {!collapsed && (
                          <div className="px-5 pb-3 pt-1">
                            <table className="w-full">
                              <thead>
                                <tr className="text-[9px] text-slate-400 uppercase tracking-widest">
                                  <th className="text-left font-black py-1">Parámetro</th>
                                  <th className="font-black py-1">Resultado</th>
                                  <th className="font-black py-1">Límite norma</th>
                                  <th className="font-black py-1">Validez</th>
                                </tr>
                              </thead>
                              <tbody>
                                {grp.params.map((p) => {
                                  const raw = results[p.k] ?? "";
                                  const status = evalParam(p, raw, currentPoint);
                                  return (
                                    <tr key={p.k} className="border-b border-slate-50">
                                      <td className="py-3 pr-4">
                                        <span className="text-[12px] font-bold text-slate-900">{p.n}</span>{" "}
                                        <span className="text-[10px] text-slate-400 font-semibold">{p.u}</span>
                                      </td>
                                      <td className="py-3 px-2 w-40">
                                        {p.type ? (
                                          <select
                                            className="w-full p-2.5 text-sm font-bold border border-slate-200 rounded-lg"
                                            value={raw}
                                            onChange={(e) => updateResult(p.k, e.target.value)}
                                          >
                                            <option value="">—</option>
                                            <option value="0">{p.type === "micro" ? "Ausencia (<1.1)" : "No objetable"}</option>
                                            <option value="1">{p.type === "micro" ? "Presencia (≥1.1)" : "Objetable"}</option>
                                          </select>
                                        ) : (
                                          <input
                                            type="number"
                                            step="0.0001"
                                            className="w-full p-2.5 text-sm font-bold font-mono text-center border border-slate-200 rounded-lg"
                                            value={raw}
                                            onChange={(e) => updateResult(p.k, e.target.value)}
                                          />
                                        )}
                                      </td>
                                      <td className="py-3 px-2 w-32 text-center font-mono text-[11px] text-slate-500 font-semibold">{limText(p, currentPoint)}</td>
                                      <td className="py-3 pl-2 w-16 text-center">
                                        <span
                                          className={`inline-block w-3.5 h-3.5 rounded-full border ${
                                            status === "ok"
                                              ? "bg-success-green border-success-green shadow-[0_0_10px_#10b981]"
                                              : status === "bad"
                                                ? "bg-danger-red border-danger-red shadow-[0_0_10px_#ef4444]"
                                                : status === "op"
                                                  ? "bg-slate-400 border-slate-400"
                                                  : "bg-slate-200 border-slate-200"
                                          }`}
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Panel cumplimiento + índices + IA */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 card-shadow lg:col-span-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Dictamen de Cumplimiento</h4>
                  <ComplianceGauge percentage={compliance.pct} />
                  <p className="text-[11px] text-slate-500 font-semibold mt-3">
                    <span className="font-mono font-bold">{compliance.evald}</span> parámetros evaluados ·{" "}
                    <span className="font-mono font-bold text-danger-red">{compliance.fail}</span> no conformidades
                  </p>

                  <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Índice de saturación de Langelier (LSI)</p>
                      <p className="text-[11px] font-semibold leading-snug">
                        <span className="font-mono font-bold text-navy-blue text-sm">{lsi ? `${lsi.value > 0 ? "+" : ""}${lsi.value.toFixed(2)}` : "—"}</span>{" "}
                        <span className="text-slate-500">{lsi ? lsi.label : "requiere pH, T°, SDT, dureza y alcalinidad"}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Índice combinado nitratos + nitritos</p>
                      <p className="text-[11px] font-semibold leading-snug">
                        <span className="font-mono font-bold text-navy-blue text-sm">{nIndex ? nIndex.value.toFixed(2) : "—"}</span>{" "}
                        <span className={nIndex ? (nIndex.conforme ? "text-success-green" : "text-danger-red") : "text-slate-500"}>
                          {nIndex ? (nIndex.conforme ? "≤ 1 — conforme" : "Supera 1 — NO conforme") : "[NO₃]/50 + [NO₂]/3 ≤ 1"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 card-shadow lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diagnóstico Técnico Automático</h4>
                    <AiButton onClick={handleDiagnosis} loading={loadingDiagnosis} label="Generar diagnóstico" />
                  </div>
                  <textarea
                    rows={7}
                    className="w-full p-4 rounded-2xl text-sm leading-relaxed border border-slate-200 bg-white text-slate-900"
                    placeholder="Hallazgos, interpretación frente a la norma aplicable y recomendaciones de operación del tren de tratamiento…"
                    value={diagnostico}
                    onChange={(e) => setDiagnostico(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  className="bg-navy-blue text-white px-16 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] hover:bg-slate-800 shadow-2xl transition-all active:scale-95 border-b-4 border-black"
                >
                  Registrar Ensayo
                </button>
              </div>
            </div>
          )}

          {/* ============ TAB 2: SPC ============ */}
          {activeTab === "spc" && (
            <div className="space-y-8 fade-in">
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 card-shadow">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-6 mb-8">
                  <div>
                    <h3 className="text-navy-blue text-lg font-black uppercase tracking-tight">Control Estadístico de Proceso</h3>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1">Carta de control de Shewhart (individuos · ±3σ) e índices de capacidad Cp / Cpk</p>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <SelectField
                      label="Punto"
                      value={spcPoint}
                      onChange={(e) => setSpcPoint(e.target.value as SamplePoint)}
                      options={(["SALIDA", "CRUDA", "RED"] as SamplePoint[]).map((pt) => ({ value: pt, label: POINT_LABEL[pt] }))}
                    />
                    <SelectField
                      label="Parámetro"
                      value={spcParamKey}
                      onChange={(e) => setSpcParamKey(e.target.value)}
                      options={spcOptions.map((p) => ({ value: p.k, label: `${p.n} (${p.u})` }))}
                    />
                  </div>
                </div>

                {!spcResult ? (
                  <div className="text-center py-20">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Se requieren al menos 2 ensayos registrados para este punto y parámetro</p>
                  </div>
                ) : (
                  <>
                    <div style={{ height: 340 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={spcChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="idx" tick={{ fontSize: 10 }} label={{ value: "Orden del ensayo", position: "insideBottom", offset: -5, fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 10, fontFamily: "monospace" }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <ReferenceLine y={spcResult.mean} stroke="#0e9f6e" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "LC", fontSize: 9, fill: "#0e9f6e" }} />
                          <ReferenceLine y={spcResult.ucl} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "LCS +3σ", fontSize: 9, fill: "#94a3b8" }} />
                          <ReferenceLine y={spcResult.lcl} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "LCI −3σ", fontSize: 9, fill: "#94a3b8" }} />
                          {spcUsl != null && <ReferenceLine y={spcUsl} stroke="#dc2626" strokeWidth={1.5} label={{ value: "LME norma", fontSize: 9, fill: "#dc2626" }} />}
                          {spcLsl > 0 && <ReferenceLine y={spcLsl} stroke="#dc2626" strokeWidth={1.5} label={{ value: "LMI norma", fontSize: 9, fill: "#dc2626" }} />}
                          <Line
                            type="monotone"
                            dataKey="value"
                            name={spcParam?.n ?? ""}
                            stroke="#000040"
                            strokeWidth={2}
                            dot={(props: { cx?: number; cy?: number; index?: number }) => {
                              const { cx, cy, index } = props;
                              const bad = index != null ? spcResult.outOfControl[index] : false;
                              return <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} fill={bad ? "#dc2626" : "#000040"} stroke={bad ? "#dc2626" : "#000040"} />;
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-10">
                      <div className="bg-white p-5 rounded-xl border border-slate-200 border-l-4 border-l-navy-blue">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Media (LC)</p>
                        <p className="font-mono text-2xl font-extrabold text-navy-blue mt-1">{spcResult.mean.toFixed(3)}</p>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">σ estimada</p>
                        <p className="font-mono text-2xl font-extrabold mt-1">{spcResult.sigma.toFixed(3)}</p>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">LCS (+3σ)</p>
                        <p className="font-mono text-2xl font-extrabold mt-1">{spcResult.ucl.toFixed(3)}</p>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">LCI (−3σ)</p>
                        <p className="font-mono text-2xl font-extrabold mt-1">{Math.max(spcResult.lcl, 0).toFixed(3)}</p>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cp</p>
                        <p className="font-mono text-2xl font-extrabold text-navy-blue mt-1">{spcResult.cp != null ? spcResult.cp.toFixed(2) : "—"}</p>
                      </div>
                      <div className="bg-white p-5 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cpk</p>
                        <p
                          className="font-mono text-2xl font-extrabold mt-1"
                          style={{ color: spcResult.cpk == null ? "#0f172a" : spcResult.cpk >= 1.33 ? "#0e9f6e" : spcResult.cpk >= 1 ? "#c2710c" : "#dc2626" }}
                        >
                          {spcResult.cpk != null ? spcResult.cpk.toFixed(2) : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Interpretación de capacidad</p>
                        <p className="text-[12px] text-slate-700 font-semibold leading-relaxed">{spcResult.interp}</p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Señales fuera de control</p>
                        <div className="text-[12px] font-semibold leading-relaxed space-y-1">
                          {spcResult.signals.length ? (
                            spcResult.signals.map((s, i) => (
                              <div key={i} className="text-danger-red">• {s}</div>
                            ))
                          ) : (
                            <div className="text-success-green">• Proceso bajo control estadístico</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-6 leading-relaxed">
                      Los <strong>límites de control</strong> (±3σ) describen la voz del proceso y se calculan de los propios datos (regla I-MR, d₂=1.128). Los{" "}
                      <strong>límites de especificación</strong> (líneas rojas) son los de la norma aplicable. Un proceso puede estar dentro de norma pero fuera de
                      control estadístico: eso anticipa una desviación antes de incumplir.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ============ TAB 3: CAPA ============ */}
          {activeTab === "capa" && (
            <div className="space-y-8 fade-in">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h3 className="text-navy-blue text-2xl font-black uppercase tracking-tight">Gestión de No Conformidades</h3>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">Derivadas automáticamente de los ensayos que incumplen la norma aplicable · Causa raíz y acción correctiva (CAPA)</p>
                </div>
                <div className="flex gap-3">
                  <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Abiertas</p>
                    <p className="font-mono text-2xl font-extrabold text-danger-red">{ncOpenClosed.open}</p>
                  </div>
                  <div className="bg-white px-6 py-3 rounded-xl border border-slate-200 text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cerradas</p>
                    <p className="font-mono text-2xl font-extrabold text-success-green">{ncOpenClosed.closed}</p>
                  </div>
                </div>
              </div>

              {ncRows.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 card-shadow p-16 text-center">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Sin no conformidades registradas — todos los ensayos cumplen la norma</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {ncRows.map((nc) => {
                    const a = capaMap.get(nc.id);
                    const estado = a?.estado ?? "Abierta";
                    const stColor = estado === "Verificada" ? "#0e9f6e" : estado === "Cerrada" ? "#0e9f6e" : estado === "En proceso" ? "#c2710c" : "#dc2626";
                    return (
                      <div key={nc.id} className="bg-white p-7 rounded-2xl border border-slate-200 card-shadow border-l-4" style={{ borderLeftColor: stColor }}>
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-sm font-black text-navy-blue uppercase tracking-wide">{nc.param.n}</span>
                              <span className="text-[9px] font-mono font-bold px-2 py-0.5 border border-slate-200 text-slate-500 rounded">{POINT_LABEL[nc.point]}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-semibold font-mono">{nc.code} · {nc.fecha} · {nc.planta || ""}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resultado vs límite</p>
                            <p className="font-mono text-sm font-bold">
                              <span className="text-danger-red">{nc.val}</span> <span className="text-slate-400">/ {nc.lim} {nc.param.u}</span>
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <SelectField
                              label="Causa raíz (Ishikawa 6M)"
                              value={a?.categoria6M ?? ""}
                              onChange={(e) => handleCapaField(nc.testId, nc.paramKey, "categoria6M", e.target.value)}
                              options={[{ value: "", label: "— Seleccione categoría —" }, ...CAUSA_6M.map((c) => ({ value: c, label: c }))]}
                              className="mb-3"
                            />
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Análisis (5 porqués)</label>
                            <textarea
                              rows={3}
                              className="w-full p-2.5 text-sm rounded-xl border border-slate-200"
                              placeholder="¿Por qué ocurrió? …"
                              defaultValue={a?.porques ?? ""}
                              onBlur={(e) => handleCapaField(nc.testId, nc.paramKey, "porques", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">Acción correctiva</label>
                            <textarea
                              rows={3}
                              className="w-full p-2.5 text-sm rounded-xl border border-slate-200 mb-3"
                              placeholder="Acción sobre la operación / dosificación / barrera…"
                              defaultValue={a?.accion ?? ""}
                              onBlur={(e) => handleCapaField(nc.testId, nc.paramKey, "accion", e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <InputField
                                label="Responsable"
                                defaultValue={a?.responsable ?? ""}
                                onBlur={(e) => handleCapaField(nc.testId, nc.paramKey, "responsable", e.target.value)}
                              />
                              <SelectField
                                label="Estado"
                                value={estado}
                                onChange={(e) => handleCapaField(nc.testId, nc.paramKey, "estado", e.target.value)}
                                options={ESTADOS_CAPA.map((e) => ({ value: e, label: e }))}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============ TAB 4: ARCHIVO ============ */}
          {activeTab === "archivo" && (
            <div className="space-y-10 fade-in">
              <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                  <h3 className="text-navy-blue text-2xl font-black uppercase tracking-tight">Archivo de Ensayos &amp; Reportes</h3>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">Historial completo de la vigilancia de calidad</p>
                </div>
                <button onClick={handleExportExcel} className="bg-navy-blue text-white px-7 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-lg">
                  Exportar histórico (Excel)
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div className="bg-white p-7 rounded-2xl border border-slate-200 card-shadow text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total ensayos</p>
                  <p className="font-mono text-4xl font-extrabold text-navy-blue mt-2">{kpiTotal}</p>
                </div>
                <div className="bg-white p-7 rounded-2xl border border-slate-200 card-shadow text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cumplimiento prom.</p>
                  <p className="font-mono text-4xl font-extrabold text-success-green mt-2">{kpiCompliance == null ? "—" : `${kpiCompliance}%`}</p>
                </div>
                <div className="bg-white p-7 rounded-2xl border border-slate-200 card-shadow text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No conformidades</p>
                  <p className="font-mono text-4xl font-extrabold text-danger-red mt-2">{ncRows.length}</p>
                </div>
                <div className="bg-white p-7 rounded-2xl border border-slate-200 card-shadow text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Último ensayo</p>
                  <p className="text-sm font-extrabold text-navy-blue mt-4 font-mono">{kpiLast}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 card-shadow">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Cumplimiento por mes</h4>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={complianceByMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontFamily: "monospace" }} />
                        <Tooltip />
                        <Bar dataKey="pct" fill="#000040" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 card-shadow">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">No conformidades por parámetro</h4>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ncByParam.length ? ncByParam : [{ name: "—", count: 0 }]} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fontFamily: "monospace" }} />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#dc2626" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 card-shadow relative">
                <Search className="absolute left-11 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                  placeholder="Buscar por planta, punto, analista, fecha…"
                  className="w-full p-3 pl-10 rounded-xl font-semibold border border-slate-200"
                />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 card-shadow overflow-x-auto">
                <table className="w-full text-left min-w-[860px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Código</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Fecha</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Planta</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 uppercase">Punto</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 uppercase text-center">Cumpl.</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 uppercase text-center">Dictamen</th>
                      <th className="p-5 text-[10px] font-black text-slate-400 uppercase text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {archiveFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                          Sin ensayos registrados
                        </td>
                      </tr>
                    ) : (
                      archiveFiltered.map((t) => {
                        const ok = t.fail === 0;
                        return (
                          <tr key={t._id} className="hover:bg-slate-50">
                            <td className="p-5 font-mono text-[11px] font-bold text-navy-blue">{t.code}</td>
                            <td className="p-5 text-[12px] font-semibold">{t.fecha}</td>
                            <td className="p-5 text-[12px] font-semibold">{t.planta || "—"}</td>
                            <td className="p-5">
                              <span className="text-[9px] font-mono font-bold px-2 py-1 border border-slate-200 text-slate-600 rounded">{POINT_LABEL[t.point]}</span>
                            </td>
                            <td className={`p-5 text-center font-mono font-bold ${ok ? "" : "text-danger-red"}`}>{t.pct}%</td>
                            <td className="p-5 text-center">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${ok ? "bg-success-green/10 text-success-green" : "bg-danger-red/10 text-danger-red"}`}>
                                {ok ? "Conforme" : "No conforme"}
                              </span>
                            </td>
                            <td className="p-5">
                              <div className="flex items-center justify-center gap-4">
                                <button onClick={() => handleShowQr(t)} title="QR" className="text-slate-400 hover:text-navy-blue transition-colors">
                                  <QrCode className="w-4 h-4" />
                                </button>
                                <button onClick={() => handlePrint(t)} title="PDF" className="text-slate-400 hover:text-navy-blue transition-colors">
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button onClick={() => setDeleteTarget(t)} title="Eliminar" className="text-slate-400 hover:text-danger-red transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                ⚠ Límites precargados: NTE INEN 1108:2020 para agua de salida y red de distribución (agua para consumo humano); TULSMA Anexo 1, Tabla 1 para agua
                cruda (aguas que requieren tratamiento convencional). Verifique cada valor contra la edición oficial vigente antes de emitir dictámenes con
                validez legal.
              </p>
            </div>
          )}
        </main>

        {/* QR MODAL */}
        {qrTarget && (
          <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-6" onClick={() => setQrTarget(null)}>
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end">
                <button onClick={() => setQrTarget(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[9px] font-black tracking-[0.22em] uppercase text-slate-400 mb-1">TeraH2O · Verificación de certificado</p>
              <p className="font-mono text-sm font-bold text-navy-blue mb-5">{qrTarget.test.code}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrTarget.dataUrl} className="mx-auto border border-slate-200 p-2" style={{ width: 220, height: 220 }} alt="Código QR" />
              <p className="text-[11px] text-slate-500 font-semibold mt-5 leading-relaxed">
                Escanee para abrir el certificado registrado en el sistema (requiere sesión iniciada).
              </p>
              <a href={verifyUrl(qrTarget.test.code, qrTarget.test._id)} target="_blank" rel="noopener noreferrer" className="block mt-4 text-[10px] font-mono text-navy-blue underline break-all">
                {verifyUrl(qrTarget.test.code, qrTarget.test._id)}
              </a>
              <button onClick={() => setQrTarget(null)} className="mt-6 bg-navy-blue text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest w-full">
                Cerrar
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={!!deleteTarget}
          title="Eliminar ensayo"
          message={`¿Eliminar el ensayo ${deleteTarget?.code ?? ""} del archivo? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </AuthGuard>
  );
}
