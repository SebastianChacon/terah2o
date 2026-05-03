"use client";

import { useState } from "react";
import Link from "next/link";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { useWeather } from "@/hooks/useWeather";
import { useGeminiTts } from "@/hooks/useGeminiTts";
import { COAGULANT_OPTIONS } from "@/types/chemical";
import {
  predictTurbidity,
  calculatePeakDose,
  calculateMeteoFlowRate,
  calculateMeteoDailyConsumption,
  calculateAutonomy,
  projectRainfall,
} from "@/lib/calculations/turbidity";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ReferenceLine,
} from "recharts";

/* ── helpers ── */
function riskColor(v: number) {
  if (v > 70) return "text-red-400";
  if (v > 40) return "text-amber-400";
  return "text-green-400";
}
function riskBg(v: number) {
  if (v > 70) return "bg-red-500";
  if (v > 40) return "bg-amber-400";
  return "bg-green-500";
}
function stockColor(pct: number) {
  if (pct > 50) return "bg-green-500";
  if (pct > 20) return "bg-amber-400";
  return "bg-red-500";
}

/* ── export report ── */
function exportReport(params: {
  plantName: string;
  location: string;
  chemical: string;
  avgConc: number;
  ntuBase: number;
  plantFlowLps: number;
  rainIntensity: number;
  rainDuration: number;
  severityLabel: string;
  stockKg: number;
  peakDose: number;
  flowMlMin: number;
  dailyCons: number;
  autonomy: number;
  maxNTU: number;
  deltaNTU: number;
  rGlobal: number;
  inenLabel: string;
  weatherTemp: string;
  weatherHumidity: string;
  weatherPressure: string;
  weatherWind: string;
  weatherDesc: string;
  recommendations: { title: string; context: string; content: string }[];
}) {
  const now = new Date();
  const date = now.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const recsHtml = params.recommendations
    .map(
      (r) =>
        `<tr><td style="padding:6px 10px;font-family:Arial,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;color:#2c5fa8;white-space:nowrap;">${r.title}</td><td style="padding:6px 10px;font-size:12px;">${r.content}</td></tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>TeraH2O · Reporte Hidrometeorológico · ${date}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#f0f6fd;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0b1830;}
.page{max-width:880px;margin:0 auto;background:#fff;padding:36px 44px;box-shadow:0 2px 16px rgba(0,30,80,0.07);}
.logo-t{font-family:Arial,sans-serif;font-weight:700;font-size:24px;color:#0b1830;text-transform:uppercase;}
.logo-h{font-family:Arial,sans-serif;font-weight:700;font-size:24px;color:#3d7cc9;text-transform:uppercase;}
.sub{font-family:Arial,sans-serif;font-size:8px;letter-spacing:0.28em;color:#8aaac8;text-transform:uppercase;display:block;margin-top:3px;}
.lbl{font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4a7abf;}
.kval{font-family:Arial,sans-serif;font-weight:700;font-size:1.4rem;color:#0b1830;}
.kpi-g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0;}
.kpi-b{padding:11px 13px;border:1px solid #b0cce8;border-radius:2px;border-top:3px solid #3d7cc9;}
.sec{margin-top:20px;}
.st{font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#2c5fa8;border-bottom:1px solid #b0cce8;padding-bottom:5px;margin-bottom:10px;}
table{width:100%;border-collapse:collapse;}
td,th{padding:6px 9px;border:1px solid #d4e8f8;font-size:12px;}
th{background:#e8f3fc;font-family:Arial,sans-serif;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#3d7cc9;font-size:10px;}
.disc{background:#e8f3fc;border:1px solid #a8cce8;border-left:4px solid #3d7cc9;border-radius:2px;padding:11px 15px;margin-top:18px;font-size:11px;line-height:1.65;color:#1a3a5c;}
.foot{border-top:1px solid #b0cce8;margin-top:24px;padding-top:12px;display:flex;justify-content:space-between;align-items:center;}
@media print{body{background:#fff;}.page{box-shadow:none;padding:18px 22px;}}
</style></head><body><div class="page">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #a8cce8;">
  <div>
    <div><span class="logo-t">TERA</span><span class="logo-h">H2O</span></div>
    <span class="sub">✦ Inteligencia Operativa</span>
  </div>
  <div style="text-align:right;">
    <div style="font-family:Arial,sans-serif;font-weight:700;font-size:15px;text-transform:uppercase;letter-spacing:0.06em;color:#0b1830;">Reporte Hidrometeorológico</div>
    ${params.plantName ? `<div style="font-family:Arial,sans-serif;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#3d7cc9;margin-top:3px;">${params.plantName}</div>` : ""}
    <div class="lbl" style="margin-top:4px;">${params.location} · ${date} · ${time}</div>
  </div>
</div>
<div class="sec"><div class="st">Indicadores Clave de Operación</div>
<div class="kpi-g">
  <div class="kpi-b" style="border-top-color:#2dd4bf;"><div class="lbl" style="color:#2dd4bf;">Dosis Pico</div><div class="kval">${params.peakDose} mg/L</div></div>
  <div class="kpi-b" style="border-top-color:#f59e0b;"><div class="lbl" style="color:#f59e0b;">Aforo Bomba</div><div class="kval">${params.flowMlMin} ml/min</div></div>
  <div class="kpi-b" style="border-top-color:#22c55e;"><div class="lbl" style="color:#22c55e;">Consumo Diario</div><div class="kval">${params.dailyCons} kg/d</div></div>
  <div class="kpi-b" style="border-top-color:#3d7cc9;"><div class="lbl" style="color:#3d7cc9;">Autonomía</div><div class="kval">${params.autonomy > 99 ? "+99" : params.autonomy} días</div></div>
</div>
<div class="kpi-g">
  <div class="kpi-b"><div class="lbl">Pico NTU</div><div class="kval">${params.maxNTU}</div></div>
  <div class="kpi-b"><div class="lbl">Delta NTU</div><div class="kval">+${params.deltaNTU}</div></div>
  <div class="kpi-b"><div class="lbl">Riesgo Global</div><div class="kval">${params.rGlobal}%</div></div>
  <div class="kpi-b"><div class="lbl">INEN 1108</div><div class="kval" style="font-size:0.9rem;">${params.inenLabel}</div></div>
</div></div>
<div class="sec"><div class="st">Parámetros de Entrada</div>
<table><tr><th>Parámetro</th><th>Valor</th><th>Parámetro</th><th>Valor</th></tr>
<tr><td class="lbl">Nombre de Planta</td><td style="font-weight:700;text-transform:uppercase;">${params.plantName || "No especificada"}</td><td class="lbl">Ubicación</td><td>${params.location}</td></tr>
<tr><td class="lbl">Turbiedad Base</td><td>${params.ntuBase} NTU</td><td class="lbl">Caudal</td><td>${params.plantFlowLps} L/s</td></tr>
<tr><td class="lbl">Coagulante</td><td>${params.chemical}</td><td class="lbl">Conc. Solución</td><td>${params.avgConc}%</td></tr>
<tr><td class="lbl">Lluvia Proyectada</td><td>${params.rainIntensity} mm/día</td><td class="lbl">Duración</td><td>${params.rainDuration} días</td></tr>
<tr><td class="lbl">Severidad</td><td>${params.severityLabel}</td><td class="lbl">Stock</td><td>${params.stockKg} kg</td></tr>
</table></div>
<div class="sec"><div class="st">Condición Meteorológica</div>
<table><tr><th>Variable</th><th>Valor</th><th>Variable</th><th>Valor</th></tr>
<tr><td class="lbl">Temperatura</td><td>${params.weatherTemp}</td><td class="lbl">Humedad</td><td>${params.weatherHumidity}</td></tr>
<tr><td class="lbl">Presión</td><td>${params.weatherPressure}</td><td class="lbl">Viento</td><td>${params.weatherWind}</td></tr>
<tr><td class="lbl" colspan="2">Condición</td><td colspan="2" style="text-transform:capitalize;">${params.weatherDesc}</td></tr>
</table></div>
<div class="sec"><div class="st">Protocolo Preventivo Dinámico</div>
<table><tr><th style="width:110px;">Categoría</th><th>Acción Recomendada</th></tr>${recsHtml || '<tr><td colspan="2">Sin protocolos activos.</td></tr>'}</table></div>
<div class="disc"><strong style="font-size:11px;letter-spacing:0.08em;">⚗ VALIDACIÓN OBLIGATORIA — PRUEBA DE JARRAS:</strong><br>
Las dosificaciones son proyecciones estequiométricas. <strong>Toda dosis debe validarse mediante Prueba de Jarras antes de aplicar en planta</strong>, conforme a procedimientos estándar PTAP y norma INEN 1108. Este documento no sustituye el criterio del profesional responsable.</div>
<div class="foot">
  <div><span class="logo-t" style="font-size:14px;">TERA</span><span class="logo-h" style="font-size:14px;">H2O</span></div>
  <div class="lbl" style="font-size:9px;">© 2026 Servicios Profesionales Tera · ${date} · ${time}</div>
</div>
</div><script>window.onload=()=>setTimeout(()=>window.print(),350);<\/script>
</body></html>`;

  const win = window.open("", "_blank", "width=960,height=720");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

/* ═══════════════════════════════════════
   PAGE
═══════════════════════════════════════ */
export default function MotorInteligenciaPage() {
  const { toast, showToast } = useToast();
  const { weather, fetchWeather, fetchWeatherByCoords, loading: weatherLoading } = useWeather();
  const { speak, loading: ttsLoading } = useGeminiTts();

  /* ── config ── */
  const [plantName, setPlantName] = useState("");
  const [locMode, setLocMode] = useState<"city" | "coords">("city");
  const [location, setLocation] = useState("Samborondón, EC");
  const [coordLat, setCoordLat] = useState("");
  const [coordLon, setCoordLon] = useState("");
  const [chemical, setChemical] = useState("Alumbre");
  const [avgDose, setAvgDose] = useState(15);
  const [avgConc, setAvgConc] = useState(10);
  const [plantSize, setPlantSize] = useState("Mediana");
  const [stockKg, setStockKg] = useState(500);

  /* ── raw data ── */
  const [ntuBase, setNtuBase] = useState(12);
  const [plantFlowLps, setPlantFlowLps] = useState(150);

  /* ── simulation ── */
  const [rainIntensity, setRainIntensity] = useState(10);
  const [rainDuration, setRainDuration] = useState(2);
  const [severityMultiplier, setSeverityMultiplier] = useState(1);

  /* ── ui ── */
  const [lastSync, setLastSync] = useState<string | null>(null);

  /* ── computed ── */
  const prediction = predictTurbidity(ntuBase, rainIntensity, rainDuration, severityMultiplier);
  const peakDose = calculatePeakDose(prediction.maxNTU, ntuBase, avgDose, chemical);
  const flowMlMin = calculateMeteoFlowRate(plantFlowLps, peakDose, avgConc);
  const dailyCons = calculateMeteoDailyConsumption(plantFlowLps, peakDose);
  const autonomy = calculateAutonomy(stockKg, dailyCons);
  const rainData = projectRainfall(rainIntensity, rainDuration);
  const deltaNTU = prediction.maxNTU - ntuBase;

  const isAlert = prediction.maxNTU >= 100;

  /* ── risk index ── */
  const rNTU = Math.min(100, Math.round((prediction.maxNTU / 300) * 100));
  const rRain = Math.min(100, Math.round((rainIntensity * severityMultiplier / 80) * 100));
  const rGlobal = Math.min(100, Math.round(rNTU * 0.6 + rRain * 0.4));

  const inenLabel =
    rGlobal >= 70
      ? "⚠ INEN 1108 En Riesgo"
      : rGlobal >= 40
      ? "◉ INEN 1108 Monitorear"
      : "✓ INEN 1108 Estable";
  const inenColor =
    rGlobal >= 70 ? "text-red-400" : rGlobal >= 40 ? "text-amber-400" : "text-green-400";

  /* ── chart data ── */
  const chartData = prediction.labels.map((label, i) => ({
    name: label,
    ntu: prediction.values[i],
    rain: rainData[i],
    threshold: 100,
  }));

  /* ── stock bars ── */
  const stockBars = prediction.labels.map((label, i) => {
    const remaining = Math.max(0, stockKg - dailyCons * (i + 1));
    const pct = stockKg > 0 ? Math.min(100, (remaining / stockKg) * 100) : 0;
    return { label, remaining: Math.round(remaining), pct };
  });

  /* ── recommendations ── */
  const recommendations = (() => {
    const items: { title: string; context: string; content: string }[] = [];
    const ntu = prediction.maxNTU;

    if (ntu === 0 && rainIntensity === 0) return items;

    if (ntu < 20)
      items.push({ title: "Analítica", context: "Estable", content: "Muestreo estándar cada 2 horas. Turbímetro en línea operativo." });
    else if (ntu < 50)
      items.push({ title: "Analítica", context: "Inestabilidad Ligera", content: "Muestreo horario. Vigilar floculación. Reportar al jefe de turno." });
    else if (ntu < 100)
      items.push({ title: "Analítica", context: "Alerta Operativa", content: "Muestreo cada 30 min. Ajustar mezcla rápida. Notificar jefe de planta." });
    else
      items.push({ title: "Analítica", context: "Crisis de Calidad", content: "Muestreo continuo cada 15 min. Protocolo de emergencia activo." });

    let doseNote = `Aforar bombas a ${flowMlMin} ml/min con ${chemical} (${peakDose} mg/L).`;
    if (chemical === "Alumbre" && ntu > 80) doseNote += " Monitorear alcalinidad. Ajustar cal si pH < 6.5.";
    if (chemical === "PAC") doseNote += " Alta eficiencia: evitar sobredosificación. Verificar turbiedad ≤1 NTU.";
    if (chemical === "Ferrico") doseNote += " Controlar color residual y pH post-coagulación.";
    items.push({ title: "Dosificación", context: `${chemical} · Validar jarras`, content: doseNote });

    if (autonomy < 5)
      items.push({ title: "Inventario", context: "Compra Urgente", content: `Autonomía crítica: ${autonomy} días. Emitir orden de compra inmediata.` });
    else if (autonomy < 10)
      items.push({ title: "Inventario", context: "Reposición Próxima", content: `Autonomía de ${autonomy} días. Programar reposición en 3 días.` });

    if (rainIntensity > 30)
      items.push({ title: "Captación", context: "Lluvia Extrema", content: "Limpieza inmediata de rejillas. Vigilar arrastre de sólidos." });
    else if (rainIntensity > 5)
      items.push({ title: "Entorno Hídrico", context: "Lluvia Activa", content: "Vigilar cambios en color/turbiedad en punto de toma. Mayor frecuencia de muestreo." });

    if (ntu > 100)
      items.push({ title: "Procesos", context: "Alta Carga NTU", content: "Purga continua de sedimentadores. Lavados preventivos de filtros por turno." });
    if (ntu > 150)
      items.push({ title: "INEN 1108", context: "Riesgo Incumplimiento", content: "Turbiedad supera umbral crítico. Activar contingencia y notificar autoridad sanitaria." });

    return items;
  })();

  /* ── weather badge ── */
  const rainStatus = !weather
    ? { label: "Sin Sync", cls: "text-gray-400 border-gray-700 bg-gray-800/40" }
    : weather.pop > 60
    ? { label: "Alerta Lluvia", cls: "text-red-400 border-red-500/50 bg-red-900/20" }
    : weather.pop > 20
    ? { label: "Inestable", cls: "text-amber-400 border-amber-500/40 bg-amber-900/20" }
    : { label: "Estable", cls: "text-green-400 border-green-500/35 bg-green-900/15" };

  /* ── sync handler ── */
  const handleSync = async () => {
    let data = null;
    if (locMode === "coords") {
      const latNum = parseFloat(coordLat);
      const lonNum = parseFloat(coordLon);
      if (isNaN(latNum) || isNaN(lonNum)) {
        showToast("Ingrese latitud y longitud válidas", "error");
        return;
      }
      data = await fetchWeatherByCoords(latNum, lonNum);
    } else {
      if (!location.trim()) {
        showToast("Ingrese una ubicación válida", "error");
        return;
      }
      data = await fetchWeather(location);
    }
    if (data) {
      setRainIntensity(data.rain24h);
      setLastSync(
        new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })
      );
      showToast(`✓ Clima de ${data.cityName} sincronizado`, "success");
    } else {
      showToast("Error al obtener datos climáticos", "error");
    }
  };

  /* ── speak handler ── */
  const handleSpeak = async () => {
    const loc = locMode === "coords" ? weather?.cityName ?? `${coordLat},${coordLon}` : location;
    const recText = recommendations.map((r) => `${r.title}. ${r.content}`).join(". ");
    const text = [
      "Protocolo operativo TeraH2O.",
      plantName ? `Planta de tratamiento: ${plantName}.` : "",
      `Planta monitoreada: ${loc}.`,
      `Estado normativo: ${inenLabel}.`,
      `Riesgo hídrico global: ${rGlobal} por ciento.`,
      `Turbiedad pico proyectada: ${prediction.maxNTU} NTU.`,
      `Dosis de coagulante sugerida: ${peakDose} miligramos por litro.`,
      `Aforo de bomba dosificadora: ${flowMlMin} mililitros por minuto.`,
      `Autonomía química disponible: ${autonomy > 99 ? "más de 99" : autonomy} días.`,
      recommendations.length > 0 ? `Protocolos preventivos activos: ${recText}` : "",
      "Aviso importante. Toda dosis calculada debe validarse mediante prueba de jarras, conforme a norma INEN mil ciento ocho.",
    ]
      .filter(Boolean)
      .join(" ");
    await speak(text);
  };

  const handleClear = () => {
    setNtuBase(0);
    setPlantFlowLps(0);
    setRainIntensity(0);
    setRainDuration(0);
    setSeverityMultiplier(1);
    showToast("Planta en reposo.", "success");
  };

  const severityLabel =
    severityMultiplier === 1
      ? "Base (Ligera)"
      : severityMultiplier === 2.5
      ? "Moderada"
      : severityMultiplier === 6
      ? "Intensa"
      : "Saturación Cuenca";

  return (
    <div className="min-h-screen bg-[#08101e] text-[#e8f2fc]">
      <Toast {...toast} />

      {/* ══ HEADER ══ */}
      <header className="sticky top-0 z-50 bg-[#08101e]/97 backdrop-blur-lg border-b border-[rgba(61,124,201,0.22)]">
        <div className="max-w-[1300px] mx-auto px-5 py-3 flex flex-wrap justify-between items-center gap-3">
          {/* Left: logo + title */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col leading-none">
              <div className="flex items-baseline">
                <span className="font-bold text-[1.7rem] text-white uppercase tracking-wider" style={{ fontFamily: "Arial, sans-serif" }}>
                  TERA
                </span>
                <span className="font-bold text-[1.7rem] text-[#3d7cc9] uppercase tracking-wider" style={{ fontFamily: "Arial, sans-serif" }}>
                  H2O
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-[9px] font-semibold tracking-[0.28em] uppercase text-[rgba(180,200,230,0.55)]">
                <span className="text-[#f5c518] text-xs">✦</span>
                <span>Inteligencia Operativa</span>
              </div>
            </div>
            <div className="w-px h-9 bg-[rgba(61,124,201,0.22)]" />
            <div>
              <p className="font-bold text-[0.9rem] tracking-[0.08em] uppercase text-[#e8f2fc]">
                Motor Hidrometeorológico
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {plantName && (
                  <>
                    <span className="text-[10px] font-bold tracking-[0.06em] uppercase text-[#e8f2fc]">
                      {plantName}
                    </span>
                    <span className="text-[rgba(61,124,201,0.45)] text-[10px]">·</span>
                  </>
                )}
                <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#3d7cc9]">
                  {weather?.cityName ?? (locMode === "coords" && coordLat && coordLon ? `${coordLat}, ${coordLon}` : location)}
                </span>
                <span className="text-[rgba(61,124,201,0.45)] text-[10px]">·</span>
                <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[rgba(61,124,201,0.45)]">
                  {chemical}
                </span>
                <span className="text-[rgba(61,124,201,0.45)] text-[10px]">·</span>
                <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-green-400">
                  INEN 1108
                </span>
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {lastSync && (
              <span className="text-[10px] tracking-wider uppercase text-[rgba(61,124,201,0.35)]">
                {lastSync}
              </span>
            )}
            {weatherLoading && (
              <span className="text-[#3d7cc9] text-lg animate-pulse">●</span>
            )}
            <Link
              href="/"
              className="text-[rgba(61,124,201,0.45)] hover:text-[#3d7cc9] text-[10px] font-bold tracking-widest uppercase transition-colors"
            >
              ← Inicio
            </Link>
            <button
              onClick={() =>
                exportReport({
                  plantName,
                  location: weather?.cityName ?? location,
                  chemical,
                  avgConc,
                  ntuBase,
                  plantFlowLps,
                  rainIntensity,
                  rainDuration,
                  severityLabel,
                  stockKg,
                  peakDose,
                  flowMlMin,
                  dailyCons,
                  autonomy,
                  maxNTU: prediction.maxNTU,
                  deltaNTU,
                  rGlobal,
                  inenLabel,
                  weatherTemp: weather ? `${weather.temp}°C` : "--",
                  weatherHumidity: weather ? `${weather.humidity}%` : "--",
                  weatherPressure: weather?.pressure ? `${weather.pressure} hPa` : "--",
                  weatherWind: weather?.windSpeed ? `${weather.windSpeed} km/h` : "--",
                  weatherDesc: weather?.description ?? "--",
                  recommendations,
                })
              }
              className="border border-[rgba(61,124,201,0.22)] text-[#3d7cc9] text-[10px] font-bold px-3 py-1.5 uppercase tracking-[0.15em] rounded-sm hover:bg-[rgba(61,124,201,0.15)] transition-all"
            >
              ↓ Reporte
            </button>
            <button
              onClick={handleSync}
              disabled={weatherLoading}
              className="bg-[#3d7cc9] text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-[0.15em] rounded-sm hover:opacity-85 transition-opacity disabled:opacity-50"
            >
              ↻ Sincronizar Clima
            </button>
            <NavbarUser />
          </div>
        </div>
      </header>

      {/* ══ MAIN ══ */}
      <main className="max-w-[1300px] mx-auto px-5 py-5 grid grid-cols-1 lg:grid-cols-[295px_1fr] gap-4">

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-3">

          {/* Atmospheric monitoring */}
          <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm overflow-hidden hover:border-[rgba(61,124,201,0.6)] transition-colors">
            <div className="px-4 py-2.5 border-b border-[rgba(61,124,201,0.22)] flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9]">
                Monitoreo Atmosférico
              </span>
              <span className={`text-[9px] font-bold tracking-[0.16em] uppercase px-2 py-0.5 rounded-sm border ${rainStatus.cls}`}>
                {rainStatus.label}
              </span>
            </div>
            <div className="px-4 py-3 flex justify-between items-end">
              <div>
                <div className="flex items-end gap-1">
                  <span className="font-bold text-[2.8rem] leading-none text-[#e8f2fc]" style={{ fontFamily: "Arial, sans-serif" }}>
                    {weather ? `${weather.temp}°` : "--°"}
                  </span>
                  <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[rgba(61,124,201,0.45)] mb-1">C</span>
                </div>
                <p className="text-[11px] font-semibold tracking-[0.06em] capitalize text-[#3d7cc9] mt-1">
                  {weather?.description ?? "Sin datos · sincronizar"}
                </p>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Prob. Lluvia</div>
                <div className="font-bold text-[1.5rem] leading-none text-amber-400" style={{ fontFamily: "Arial, sans-serif" }}>
                  {weather ? `${weather.pop}%` : "--%"}
                </div>
              </div>
            </div>
            <div className="border-t border-[rgba(61,124,201,0.22)] grid grid-cols-2">
              {[
                { label: "Humedad", val: weather ? `${weather.humidity}%` : "--%" },
                { label: "Presión", val: weather?.pressure ? `${weather.pressure} hPa` : "-- hPa" },
                { label: "Nubosidad", val: weather?.cloudCover !== undefined ? `${weather.cloudCover}%` : "--%" },
                { label: "Visibilidad", val: weather?.visibility !== undefined ? `${weather.visibility} km` : "-- km" },
                { label: "Sensación", val: weather?.feelsLike !== undefined ? `${weather.feelsLike}°C` : "--°C" },
                { label: "Viento", val: weather?.windSpeed !== undefined ? `${weather.windSpeed} km/h` : "-- km/h" },
              ].map(({ label, val }, i) => (
                <div
                  key={label}
                  className={`px-3 py-2 border-[rgba(61,124,201,0.22)] ${i % 2 === 0 ? "border-r" : ""} ${i < 4 ? "border-b" : ""}`}
                >
                  <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-0.5">{label}</div>
                  <div className="font-bold text-[1rem] text-[#e8f2fc]" style={{ fontFamily: "Arial, sans-serif" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Plant config */}
          <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm overflow-hidden hover:border-[rgba(61,124,201,0.6)] transition-colors">
            <div className="px-4 py-2.5 border-b border-[rgba(61,124,201,0.22)]">
              <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9]">Configuración de Planta</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2.5">
              {/* Plant name */}
              <div>
                <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">
                  Nombre de la Planta
                </label>
                <input
                  type="text"
                  placeholder="Ej: PTAP El Plateado"
                  className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold uppercase tracking-wide outline-none focus:border-[#3d7cc9] transition-colors"
                  value={plantName}
                  onChange={(e) => setPlantName(e.target.value)}
                />
              </div>

              {/* Location mode toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)]">Ubicación</label>
                  <div className="flex border border-[rgba(61,124,201,0.22)] rounded-sm overflow-hidden">
                    <button
                      onClick={() => setLocMode("city")}
                      className={`px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] uppercase transition-all ${locMode === "city" ? "bg-[#3d7cc9] text-white" : "bg-transparent text-[rgba(61,124,201,0.45)] hover:text-[#3d7cc9]"}`}
                    >
                      Ciudad
                    </button>
                    <button
                      onClick={() => setLocMode("coords")}
                      className={`px-2.5 py-1 text-[9px] font-bold tracking-[0.12em] uppercase transition-all ${locMode === "coords" ? "bg-[#3d7cc9] text-white" : "bg-transparent text-[rgba(61,124,201,0.45)] hover:text-[#3d7cc9]"}`}
                    >
                      Coords
                    </button>
                  </div>
                </div>

                {locMode === "city" ? (
                  <input
                    type="text"
                    placeholder="Ej: Loja, EC"
                    className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[9px] font-semibold tracking-[0.1em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Latitud</label>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="-3.9985"
                        className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                        value={coordLat}
                        onChange={(e) => setCoordLat(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold tracking-[0.1em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Longitud</label>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="-79.2035"
                        className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                        value={coordLon}
                        onChange={(e) => setCoordLon(e.target.value)}
                      />
                    </div>
                    {coordLat && coordLon && (
                      <div className="col-span-2 px-2 py-1 bg-[rgba(61,124,201,0.07)] border border-[rgba(61,124,201,0.22)] rounded-sm">
                        <span className="text-[9px] font-semibold text-[rgba(180,210,240,0.7)]">
                          📍 {parseFloat(coordLat).toFixed(4)}°, {parseFloat(coordLon).toFixed(4)}°
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chemical */}
              <div>
                <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Coagulante</label>
                <select
                  className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                  value={chemical}
                  onChange={(e) => setChemical(e.target.value)}
                >
                  {COAGULANT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#0c1828]">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dose + Conc */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Dosis Base mg/L</label>
                  <input
                    type="number"
                    className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                    value={avgDose}
                    onChange={(e) => setAvgDose(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Conc. Sol. %</label>
                  <input
                    type="number"
                    className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                    value={avgConc}
                    onChange={(e) => setAvgConc(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Scale + Stock */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Escala PTAP</label>
                  <select
                    className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                    value={plantSize}
                    onChange={(e) => setPlantSize(e.target.value)}
                  >
                    <option className="bg-[#0c1828]" value="Pequeña">Rural</option>
                    <option className="bg-[#0c1828]" value="Mediana">Urbana</option>
                    <option className="bg-[#0c1828]" value="Grande">Metro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Stock (kg)</label>
                  <input
                    type="number"
                    className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                    value={stockKg}
                    onChange={(e) => setStockKg(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Raw water */}
          <div className={`bg-[#0c1828] border rounded-sm overflow-hidden transition-colors ${isAlert ? "border-red-500/50 animate-pulse" : "border-[rgba(61,124,201,0.22)] hover:border-[rgba(61,124,201,0.6)]"}`}>
            <div className="px-4 py-2.5 border-b border-[rgba(61,124,201,0.22)] flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9]">Agua Cruda</span>
              <button
                onClick={handleClear}
                className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[rgba(61,124,201,0.35)] hover:text-[#3d7cc9] bg-transparent border-none cursor-pointer transition-colors"
              >
                ✕ Limpiar
              </button>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Turbiedad Base (NTU)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-xl font-bold outline-none focus:border-[#3d7cc9] transition-colors"
                  value={ntuBase}
                  onChange={(e) => setNtuBase(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Caudal de Operación (L/s)</label>
                <input
                  type="number"
                  className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-xl font-bold outline-none focus:border-[#3d7cc9] transition-colors"
                  value={plantFlowLps}
                  onChange={(e) => setPlantFlowLps(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Simulation */}
          <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm overflow-hidden hover:border-[rgba(61,124,201,0.6)] transition-colors">
            <div className="px-4 py-2.5 border-b border-[rgba(61,124,201,0.22)]">
              <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9]">Simulación de Evento</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Intensidad Lluvia (mm/día)</label>
                <input
                  type="number"
                  className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                  value={rainIntensity}
                  onChange={(e) => setRainIntensity(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Duración (días)</label>
                <input
                  type="number"
                  className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                  value={rainDuration}
                  onChange={(e) => setRainDuration(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">Severidad del Evento</label>
                <select
                  className="w-full bg-[rgba(5,10,22,0.9)] border border-[rgba(61,124,201,0.2)] text-[#3d7cc9] px-2.5 py-1.5 rounded-sm text-sm font-semibold outline-none focus:border-[#3d7cc9] transition-colors"
                  value={severityMultiplier}
                  onChange={(e) => setSeverityMultiplier(parseFloat(e.target.value))}
                >
                  <option className="bg-[#0c1828]" value={1}>Base (Ligera)</option>
                  <option className="bg-[#0c1828]" value={2.5}>Moderada</option>
                  <option className="bg-[#0c1828]" value={6}>Intensa</option>
                  <option className="bg-[#0c1828]" value={15}>Saturación Cuenca</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-3">

          {/* Jar test disclaimer */}
          <div className="bg-[rgba(61,124,201,0.05)] border border-l-[3px] border-[rgba(61,124,201,0.22)] border-l-[#3d7cc9] rounded-sm px-4 py-2.5 flex items-start gap-2.5">
            <span className="text-[#3d7cc9] text-base flex-shrink-0 mt-0.5">⚗</span>
            <p className="text-[11px] tracking-[0.04em] leading-relaxed text-[rgba(180,210,240,0.75)]">
              <strong className="text-[#3d7cc9] tracking-[0.1em]">VALIDACIÓN REQUERIDA —</strong>{" "}
              Las dosis son proyecciones estequiométricas del Motor TeraH2O.{" "}
              <strong className="text-[#e8f2fc]">Toda dosis debe validarse mediante Prueba de Jarras antes de aplicar en planta</strong>,
              conforme a procedimientos PTAP y norma INEN 1108.
            </p>
          </div>

          {/* 4 KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Dosis pico */}
            <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm p-4 relative overflow-hidden hover:border-[rgba(61,124,201,0.6)] transition-colors">
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-cyan-400 mb-1.5">Dosis Pico Proyectada</div>
              <div className="font-bold text-[1.85rem] leading-none text-cyan-400" style={{ fontFamily: "Arial, sans-serif" }}>
                {peakDose} <span className="text-[0.85rem] opacity-55 font-normal">mg/L</span>
              </div>
              <div className="h-0.5 bg-[rgba(61,124,201,0.1)] rounded mt-2 overflow-hidden">
                <div className="h-full bg-cyan-400 rounded transition-all duration-700" style={{ width: `${Math.min(100, (peakDose / 50) * 100)}%` }} />
              </div>
            </div>
            {/* Aforo */}
            <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm p-4 relative overflow-hidden hover:border-[rgba(61,124,201,0.6)] transition-colors">
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-amber-400 mb-1.5">Aforo Bomba</div>
              <div className="font-bold text-[1.85rem] leading-none text-amber-400" style={{ fontFamily: "Arial, sans-serif" }}>
                {flowMlMin} <span className="text-[0.85rem] opacity-55 font-normal">ml/min</span>
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[rgba(61,124,201,0.45)] mt-2">
                Sol. al {avgConc}%
              </div>
            </div>
            {/* Consumo */}
            <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm p-4 relative overflow-hidden hover:border-[rgba(61,124,201,0.6)] transition-colors">
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-green-400 mb-1.5">Consumo Diario</div>
              <div className="font-bold text-[1.85rem] leading-none text-green-400" style={{ fontFamily: "Arial, sans-serif" }}>
                {dailyCons} <span className="text-[0.85rem] opacity-55 font-normal">kg/d</span>
              </div>
              <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[rgba(61,124,201,0.45)] mt-2">
                Stock: {stockKg} kg
              </div>
            </div>
            {/* Autonomía */}
            <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm p-4 relative overflow-hidden hover:border-[rgba(61,124,201,0.6)] transition-colors">
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9] mb-1.5">Autonomía Química</div>
              <div className="font-bold text-[1.85rem] leading-none text-[#3d7cc9]" style={{ fontFamily: "Arial, sans-serif" }}>
                {autonomy > 99 ? "+99" : autonomy} <span className="text-[0.85rem] opacity-55 font-normal">días</span>
              </div>
              <div className="h-0.5 bg-[rgba(61,124,201,0.1)] rounded mt-2 overflow-hidden">
                <div
                  className="h-full bg-[#3d7cc9] rounded transition-all duration-700"
                  style={{ width: `${Math.min(100, (Math.min(autonomy, 99) / 30) * 100)}%`, opacity: autonomy < 5 ? 0.4 : 1 }}
                />
              </div>
            </div>
          </div>

          {/* Risk index + Ambient conditions */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3">
            {/* Risk index */}
            <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm overflow-hidden hover:border-[rgba(61,124,201,0.6)] transition-colors">
              <div className="px-4 py-2.5 border-b border-[rgba(61,124,201,0.22)] flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9]">Índice de Riesgo Hídrico Compuesto</span>
                <span className={`text-[9px] font-bold tracking-[0.16em] uppercase px-2 py-0.5 border rounded-sm ${inenColor} border-current bg-current/10`}>
                  {inenLabel}
                </span>
              </div>
              <div className="px-4 py-3 grid grid-cols-3 gap-3">
                {[
                  { label: "Riesgo NTU", val: rNTU, barCls: "bg-cyan-400" },
                  { label: "Riesgo Lluvia", val: rRain, barCls: "bg-amber-400" },
                  { label: "Riesgo Global", val: rGlobal, barCls: riskBg(rGlobal) },
                ].map(({ label, val, barCls }) => (
                  <div key={label}>
                    <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[rgba(61,124,201,0.45)] mb-1">{label}</div>
                    <div className={`font-bold text-[1rem] mb-1 ${riskColor(val)}`} style={{ fontFamily: "Arial, sans-serif" }}>{val}%</div>
                    <div className="h-0.5 bg-[rgba(61,124,201,0.1)] rounded overflow-hidden">
                      <div className={`h-full ${barCls} rounded transition-all duration-700`} style={{ width: `${val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ambient conditions */}
            <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm overflow-hidden hover:border-[rgba(61,124,201,0.6)] transition-colors">
              <div className="px-4 py-2.5 border-b border-[rgba(61,124,201,0.22)]">
                <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9]">Condición Ambiental</span>
              </div>
              <div className="px-4">
                {[
                  { label: "Prob. Lluvia 3h", val: weather ? `${weather.pop}%` : "--%", cls: "text-amber-400" },
                  { label: "Delta Turbiedad", val: `+${deltaNTU} NTU`, cls: "text-cyan-400" },
                  { label: "Pico Proyectado", val: `${prediction.maxNTU} NTU`, cls: "text-[#e8f2fc]" },
                  { label: "Sensación", val: weather?.feelsLike !== undefined ? `${weather.feelsLike}°C` : "--°C", cls: "text-[#e8f2fc]" },
                ].map(({ label, val, cls }, i, arr) => (
                  <div
                    key={label}
                    className={`flex justify-between items-center py-2 ${i < arr.length - 1 ? "border-b border-[rgba(61,124,201,0.22)]" : ""}`}
                  >
                    <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[rgba(61,124,201,0.45)]">{label}</span>
                    <span className={`font-bold text-[1rem] ${cls}`} style={{ fontFamily: "Arial, sans-serif" }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dual-axis chart */}
          <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm p-5 relative hover:border-[rgba(61,124,201,0.6)] transition-colors">
            {isAlert && (
              <div className="absolute top-3.5 right-3.5 z-10">
                <span className="text-[9px] font-bold tracking-[0.16em] uppercase px-2 py-0.5 rounded-sm border border-red-500/60 text-red-400 bg-red-900/20 animate-pulse">
                  ⚠ Umbral Operativo Superado
                </span>
              </div>
            )}
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9] mb-0.5">
                  Dinámica NTU + Lluvia — Proyección 7 Días
                </div>
                <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[rgba(61,124,201,0.3)]">
                  Motor predictivo TeraH2O · Validar con prueba de jarras
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-0.5 bg-cyan-400 rounded" />
                  <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[rgba(61,124,201,0.45)]">Turbiedad</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-2.5 bg-amber-400/35 border border-amber-400/60 rounded-sm" />
                  <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[rgba(61,124,201,0.45)]">Lluvia</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-0 border-t-2 border-dashed border-red-400/50" />
                  <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[rgba(61,124,201,0.45)]">Límite</span>
                </div>
              </div>
            </div>

            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,124,201,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: "rgba(61,124,201,0.45)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ntu" orientation="left" tick={{ fill: "rgba(61,124,201,0.45)", fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: "NTU", angle: -90, position: "insideLeft", fill: "rgba(45,212,191,0.55)", fontSize: 10, fontWeight: 700 }} />
                  <YAxis yAxisId="rain" orientation="right" tick={{ fill: "rgba(245,158,11,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} label={{ value: "mm/día", angle: 90, position: "insideRight", fill: "rgba(245,158,11,0.45)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "rgba(8,16,30,0.97)", border: "1px solid rgba(61,124,201,0.28)", borderRadius: 3, color: "#e8f2fc" }}
                    formatter={(value, name) =>
                      name === "ntu"
                        ? [`${value} NTU`, "Turbiedad"]
                        : name === "rain"
                        ? [`${value} mm`, "Lluvia"]
                        : [value, name]
                    }
                  />
                  <ReferenceLine yAxisId="ntu" y={100} stroke="rgba(239,68,68,0.55)" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: "100 NTU", fill: "#ef4444", fontSize: 9, position: "right" }} />
                  <Bar yAxisId="rain" dataKey="rain" fill="rgba(245,158,11,0.25)" stroke="rgba(245,158,11,0.6)" strokeWidth={1} radius={[2, 2, 0, 0]} />
                  <Area yAxisId="ntu" type="monotone" dataKey="ntu" stroke={isAlert ? "#ef4444" : "#2dd4bf"} strokeWidth={2.5} fill={isAlert ? "rgba(239,68,68,0.08)" : "rgba(45,212,191,0.08)"} dot={{ fill: isAlert ? "#ef4444" : "#2dd4bf", stroke: "#08101e", strokeWidth: 2, r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {isAlert && (
              <div className="mt-3 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-sm">
                <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-red-400">
                  ⚠ Pico {prediction.maxNTU} NTU proyectado — Dosis sugerida: {peakDose} mg/L — Obligatorio validar con prueba de jarras
                </span>
              </div>
            )}
          </div>

          {/* Stock projection bars */}
          <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm p-4 hover:border-[rgba(61,124,201,0.6)] transition-colors">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9]">
                Proyección de Stock Químico — kg / día
              </span>
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[rgba(61,124,201,0.3)]">
                Consumo pico proyectado
              </span>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {stockBars.map(({ label, remaining, pct }) => (
                <div key={label} className="text-center">
                  <div className="text-[9px] font-semibold tracking-[0.1em] uppercase text-[rgba(61,124,201,0.45)] mb-1.5">{label}</div>
                  <div className="h-14 bg-[#111f38] border border-[rgba(61,124,201,0.22)] rounded-sm flex items-end overflow-hidden">
                    <div
                      className={`w-full transition-all duration-700 ${stockColor(pct)}`}
                      style={{ height: `${pct}%`, opacity: pct > 50 ? 0.8 : pct > 20 ? 0.65 : 0.55 }}
                    />
                  </div>
                  <div className={`font-bold text-[10px] mt-1 ${stockColor(pct).replace("bg-", "text-")}`} style={{ fontFamily: "Arial, sans-serif" }}>
                    {remaining}kg
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Protocols */}
          <div className="bg-[#0c1828] border border-[rgba(61,124,201,0.22)] rounded-sm p-4 hover:border-[rgba(61,124,201,0.6)] transition-colors">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#3d7cc9]">
                Protocolo Dinámico Preventivo
              </span>
              <button
                onClick={handleSpeak}
                disabled={ttsLoading}
                className="border border-[rgba(61,124,201,0.22)] text-[#3d7cc9] text-[10px] font-bold px-3 py-1 uppercase tracking-[0.15em] rounded-sm hover:bg-[rgba(61,124,201,0.15)] transition-all disabled:opacity-50"
              >
                {ttsLoading ? "Conectando..." : "✦ Oír Protocolo IA"}
              </button>
            </div>

            {recommendations.length === 0 ? (
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[rgba(61,124,201,0.3)] italic">
                Sin datos activos para protocolos preventivos.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="bg-[rgba(5,10,22,0.7)] border border-[rgba(61,124,201,0.22)] rounded-sm p-3 hover:border-[rgba(61,124,201,0.6)] transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#3d7cc9]">{rec.title}</span>
                      <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-[rgba(61,124,201,0.35)] text-right">{rec.context}</span>
                    </div>
                    <p className="text-[12px] font-normal leading-snug text-[#e8f2fc]">{rec.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ══ FOOTER ══ */}
      <footer className="max-w-[1300px] mx-auto px-5 py-4 mt-2 border-t border-[rgba(61,124,201,0.22)] flex justify-between items-center flex-wrap gap-2">
        <div className="flex flex-col leading-none">
          <div className="flex items-baseline">
            <span className="font-bold text-[1.1rem] text-white uppercase" style={{ fontFamily: "Arial, sans-serif" }}>TERA</span>
            <span className="font-bold text-[1.1rem] text-[#3d7cc9] uppercase" style={{ fontFamily: "Arial, sans-serif" }}>H2O</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[7px] font-semibold tracking-[0.28em] uppercase text-[rgba(180,200,230,0.55)]">
            <span className="text-[#f5c518]">✦</span>
            <span>Cuenca · Ecuador</span>
          </div>
        </div>
        <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[rgba(61,124,201,0.28)]">
          © 2026 Servicios Profesionales Tera · Build 5.0.0
        </div>
      </footer>
    </div>
  );
}
