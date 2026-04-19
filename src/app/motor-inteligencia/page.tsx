"use client";

import { useState, useCallback } from "react";
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
} from "@/lib/calculations/turbidity";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ReferenceLine,
} from "recharts";

export default function MotorInteligenciaPage() {
  const { toast, showToast } = useToast();
  const { weather, fetchWeather, loading: weatherLoading } = useWeather();
  const { speak, loading: ttsLoading } = useGeminiTts();

  // Config
  const [location, setLocation] = useState("Samborondón, EC");
  const [chemical, setChemical] = useState("Alumbre");
  const [avgDose, setAvgDose] = useState(15);
  const [avgConc, setAvgConc] = useState(10);
  const [plantSize, setPlantSize] = useState("Mediana");

  // Raw data
  const [ntuBase, setNtuBase] = useState(12);
  const [plantFlowLps, setPlantFlowLps] = useState(150);

  // Simulation
  const [rainIntensity, setRainIntensity] = useState(10);
  const [rainDuration, setRainDuration] = useState(2);
  const [severityMultiplier, setSeverityMultiplier] = useState(1);

  // Calculations
  const prediction = predictTurbidity(
    ntuBase,
    rainIntensity,
    rainDuration,
    severityMultiplier,
  );
  const peakDose = calculatePeakDose(
    prediction.maxNTU,
    ntuBase,
    avgDose,
    chemical,
  );
  const flowMlMin = calculateMeteoFlowRate(plantFlowLps, peakDose, avgConc);
  const dailyCons = calculateMeteoDailyConsumption(plantFlowLps, peakDose);

  const isAlert = prediction.maxNTU >= 100;

  const chartData = prediction.labels.map((label, i) => ({
    name: label,
    ntu: prediction.values[i],
    threshold: 100,
  }));

  // Recommendations
  const getRecommendations = useCallback(() => {
    const items: { title: string; context: string; content: string }[] = [];
    const ntu = prediction.maxNTU;

    if (ntu < 20)
      items.push({
        title: "Analítica",
        context: "Operación estable.",
        content: "Muestreo estándar cada 2 horas.",
      });
    else if (ntu < 50)
      items.push({
        title: "Analítica",
        context: "Inestabilidad ligera.",
        content: "Muestreo cada hora. Vigilar floculación.",
      });
    else if (ntu < 100)
      items.push({
        title: "Analítica",
        context: "Alerta operativa.",
        content: "Muestreo cada 30 min. Ajustar mezcla rápida.",
      });
    else
      items.push({
        title: "Analítica",
        context: "Crisis de calidad.",
        content:
          "Muestreo continuo cada 15 min. Riesgo de avance de turbiedad.",
      });

    let doseNote = `Aforar bombas a ${flowMlMin} ml/min.`;
    if (chemical === "Alumbre" && ntu > 80)
      doseNote += " Monitorear alcalinidad y pH.";
    if (chemical === "PAC")
      doseNote += " Producto de alta eficiencia: No sobredosificar.";
    items.push({
      title: "Dosificación",
      context: `Coagulante: ${chemical}`,
      content: doseNote,
    });

    if (rainIntensity > 30)
      items.push({
        title: "Captación",
        context: "Lluvia extrema.",
        content: "Limpieza inmediata de rejillas por arrastre sólido.",
      });
    else if (rainIntensity > 5)
      items.push({
        title: "Entorno Hídrico",
        context: "Lluvia activa.",
        content:
          "Vigilar cambios súbitos en color y turbiedad en el punto de toma.",
      });

    if (ntu > 100)
      items.push({
        title: "Procesos",
        context: "Alta carga NTU.",
        content: "Purga continua y lavados preventivos de filtros.",
      });

    return items;
  }, [prediction.maxNTU, flowMlMin, chemical, rainIntensity]);

  const recommendations = getRecommendations();

  const handleSync = async () => {
    const data = await fetchWeather(location);
    if (data) setRainIntensity(data.rain24h);
    showToast("Configuración y Clima Actualizados", "success");
  };

  const handleSpeak = async () => {
    const recText = recommendations.map((r) => r.content).join(". ");
    const text = `Atención. Protocolo operativo calibrado para la planta en ${location}. Acciones preventivas: ${recText}`;
    await speak(text);
  };

  const getRainStatus = () => {
    if (!weather) return { label: "Estable", color: "bg-green-600" };
    if (weather.pop > 60)
      return { label: "Alerta Lluvia", color: "bg-red-500" };
    if (weather.pop > 20) return { label: "Inestable", color: "bg-amber-500" };
    return { label: "Estable", color: "bg-green-600" };
  };
  const rainStatus = getRainStatus();

  return (
    <div className="min-h-screen bg-[#0a192f] text-[#ccd6f6]">
      <Toast {...toast} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a192f]/95 backdrop-blur-lg border-b border-white/10 p-4 md:px-8 md:py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight uppercase tracking-widest font-serif">
              MOTOR INTELIGENTE{" "}
              <span className="text-blue-500">HIDROMETEOROLÓGICO</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] md:text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded tracking-wide font-medium uppercase italic">
                {weather?.cityName ?? location}
              </span>
              <span className="text-[10px] md:text-xs bg-cyan-900 text-cyan-200 px-2 py-1 rounded font-bold uppercase tracking-wider">
                {chemical}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {weatherLoading && (
              <span className="animate-spin text-blue-400 text-xl">🌀</span>
            )}
            <Link
              href="/"
              className="text-white/40 hover:text-white text-xs mr-2 transition-colors"
            >
              ← Inicio
            </Link>
            <button
              onClick={handleSync}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-[10px] font-bold px-4 py-2 rounded uppercase tracking-widest shadow-lg hover:translate-y-[-1px] transition-all mr-2"
            >
              Sincronizar Datos Clima
            </button>
            <NavbarUser />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Weather */}
          <section className="bg-[#112240] border-l-4 border-green-500 p-5 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[10px] font-bold text-green-400 uppercase tracking-widest">
                Monitoreo Atmosférico
              </h3>
              <span
                className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase text-white ${rainStatus.color}`}
              >
                {rainStatus.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-[8px] text-gray-500 uppercase font-bold">
                  Temperatura
                </p>
                <p className="text-xl font-bold text-white">
                  {weather ? `${weather.temp}°C` : "--°C"}
                </p>
              </div>
              <div>
                <p className="text-[8px] text-gray-500 uppercase font-bold">
                  Humedad
                </p>
                <p className="text-xl font-bold text-white">
                  {weather ? `${weather.humidity}%` : "--%"}
                </p>
              </div>
              <div className="col-span-2 border-t border-gray-800 pt-2 mt-1">
                <p className="text-[9px] text-gray-500 uppercase">
                  Prob. Lluvia:{" "}
                  <span className="text-white font-bold">
                    {weather ? `${weather.pop}%` : "--%"}
                  </span>
                </p>
                <p className="text-[11px] text-[#64ffda] italic capitalize">
                  {weather?.description ?? "Sincronice datos..."}
                </p>
              </div>
            </div>
          </section>

          {/* Config */}
          <section className="bg-[#112240] border-l-4 border-cyan-500 p-5 rounded-lg shadow-lg">
            <h3 className="text-[10px] font-bold text-cyan-400 mb-4 uppercase tracking-widest">
              Ficha Técnica (Config.)
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1 text-[10px] uppercase font-bold">
                  Ubicación
                </label>
                <input
                  type="text"
                  className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full text-sm"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1 text-[8px] uppercase font-bold">
                  Coagulante en Uso
                </label>
                <select
                  className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full text-sm"
                  value={chemical}
                  onChange={(e) => setChemical(e.target.value)}
                >
                  {COAGULANT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 block mb-1 text-[8px] uppercase font-bold">
                  Dosis Promedio Actual (mg/L)
                </label>
                <input
                  type="number"
                  className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full text-sm"
                  value={avgDose}
                  onChange={(e) => setAvgDose(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-gray-400 block mb-1 text-[8px] uppercase font-bold">
                    Escala
                  </label>
                  <select
                    className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full text-sm"
                    value={plantSize}
                    onChange={(e) => setPlantSize(e.target.value)}
                  >
                    <option value="Pequeña">Rural</option>
                    <option value="Mediana">Urbana</option>
                    <option value="Grande">Metro</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 block mb-1 text-[8px] uppercase font-bold">
                    Conc. (%)
                  </label>
                  <input
                    type="number"
                    className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full text-sm"
                    value={avgConc}
                    onChange={(e) =>
                      setAvgConc(parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Raw data */}
          <section
            className={`bg-[#112240] border-l-4 border-blue-500 p-5 rounded-lg shadow-lg ${isAlert ? "pulse-alert" : ""}`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                Agua Cruda
              </h3>
              <button
                onClick={() => {
                  setNtuBase(0);
                  setPlantFlowLps(0);
                  setRainIntensity(0);
                  setRainDuration(0);
                  setSeverityMultiplier(1);
                }}
                className="text-[8px] text-gray-500 hover:text-red-400 border border-gray-700 px-2 py-0.5 rounded uppercase font-bold transition-all"
              >
                Limpiar
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] mb-1 text-gray-400 uppercase tracking-tighter">
                  Turbiedad Base (NTU)
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full text-lg font-bold"
                  value={ntuBase}
                  onChange={(e) => setNtuBase(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-[10px] mb-1 text-gray-400 uppercase tracking-tighter">
                  Caudal Operación (LPS)
                </label>
                <input
                  type="number"
                  className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full text-lg font-bold"
                  value={plantFlowLps}
                  onChange={(e) =>
                    setPlantFlowLps(parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </section>

          {/* Simulation */}
          <section className="bg-[#112240] border-l-4 border-yellow-600 p-5 rounded-lg shadow-lg">
            <h3 className="text-[10px] font-bold text-yellow-500 mb-4 uppercase tracking-widest">
              Simulación Dinámica
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block mb-1 text-gray-400 uppercase text-[10px]">
                  Lluvia (mm/día)
                </label>
                <input
                  type="number"
                  className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full"
                  value={rainIntensity}
                  onChange={(e) =>
                    setRainIntensity(parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-400 uppercase text-[10px]">
                  Duración (Días)
                </label>
                <input
                  type="number"
                  className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full"
                  value={rainDuration}
                  onChange={(e) =>
                    setRainDuration(parseInt(e.target.value) || 0)
                  }
                />
              </div>
              <div>
                <label className="block mb-1 text-gray-400 uppercase text-[10px]">
                  Severidad
                </label>
                <select
                  className="bg-[#0a192f] border border-[#233554] text-[#64ffda] p-2 rounded w-full"
                  value={severityMultiplier}
                  onChange={(e) =>
                    setSeverityMultiplier(parseFloat(e.target.value))
                  }
                >
                  <option value={1}>Base (Ligera)</option>
                  <option value={2.5}>Moderada</option>
                  <option value={6}>Intensa</option>
                  <option value={15}>Saturación</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#112240] border-l-4 border-cyan-500 p-6 rounded-lg text-center shadow-xl">
              <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
                Dosis Pico Proyectada
              </span>
              <div className="text-3xl font-bold text-white mt-1">
                {peakDose} mg/L
              </div>
            </div>
            <div className="bg-[#112240] border-l-4 border-orange-500 p-6 rounded-lg text-center shadow-xl">
              <span className="text-[10px] uppercase font-bold tracking-widest text-orange-400">
                Aforo Bomba (ml/min)
              </span>
              <div className="text-3xl font-bold text-white mt-1">
                {flowMlMin} ml/min
              </div>
              <div className="text-[10px] text-gray-500 mt-1 uppercase font-bold">
                Solución al {avgConc}%
              </div>
            </div>
            <div className="bg-[#112240] border-l-4 border-green-500 p-6 rounded-lg text-center shadow-xl">
              <span className="text-[10px] uppercase font-bold tracking-widest text-green-400">
                Consumo Diario
              </span>
              <div className="text-3xl font-bold text-white mt-1">
                {dailyCons} kg/d
              </div>
            </div>
          </div>

          {/* Chart */}
          <div
            className={`bg-[#112240] border-l-4 ${isAlert ? "border-red-500" : "border-blue-500"} p-6 rounded-lg min-h-[420px] shadow-xl relative`}
          >
            {isAlert && (
              <span className="absolute top-4 right-4 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase flex items-center gap-2 pulse-alert z-10">
                ⚠ Riesgo Operativo: Umbral Superado
              </span>
            )}
            <h3 className="text-sm font-semibold text-white mb-6 uppercase tracking-widest flex justify-between items-center">
              Dinámica de Turbiedad NTU (7 Días)
              <span className="text-[10px] text-blue-400 font-bold tracking-tighter uppercase">
                Análisis Predictivo Calibrado
              </span>
            </h3>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2d44" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#8892b0", fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: "#8892b0", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#112240",
                      border: "1px solid #233554",
                      borderRadius: 8,
                      color: "#ccd6f6",
                    }}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="rgba(239,68,68,0.4)"
                    strokeDasharray="5 5"
                    label={{
                      value: "Umbral 100 NTU",
                      fill: "#ef4444",
                      fontSize: 10,
                      position: "right",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ntu"
                    stroke="transparent"
                    fill={
                      isAlert
                        ? "rgba(239,68,68,0.05)"
                        : "rgba(100,255,218,0.05)"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="ntu"
                    stroke={isAlert ? "#ef4444" : "#64ffda"}
                    strokeWidth={3}
                    dot={{ fill: isAlert ? "#ef4444" : "#3b82f6", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {isAlert && (
              <div className="mt-4 p-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-200 text-xs font-medium">
                ⚠ ALERTA: Pico de {prediction.maxNTU} NTU proyectado. Requiere
                dosis de {peakDose} mg/L.
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-[#112240] border-l-4 border-[#64ffda] p-6 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">
                Protocolo Dinámico Preventivo
              </h3>
              <button
                onClick={handleSpeak}
                disabled={ttsLoading}
                className="text-[10px] bg-[#64ffda]/10 text-[#64ffda] p-1 px-3 rounded-full border border-[#64ffda]/30 hover:bg-[#64ffda] hover:text-[#0a192f] transition-all font-bold disabled:opacity-50"
              >
                {ttsLoading ? "Conectando..." : "✨ Oír Protocolo"}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="bg-[#0a192f]/60 p-4 rounded border border-blue-900/40 shadow-inner hover:border-[#64ffda]/40 transition-all"
                >
                  <span className="text-[#64ffda] font-bold text-[9px] uppercase block mb-1 underline tracking-widest">
                    {rec.title}
                  </span>
                  <span className="text-[9px] text-gray-500 italic block mb-1 uppercase font-bold">
                    {rec.context}
                  </span>
                  <span className="text-gray-200 leading-tight text-[11px]">
                    {rec.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-12 mb-8 text-center text-gray-500 text-[10px] uppercase tracking-[0.2em] border-t border-gray-800 pt-6 leading-loose">
        <p>
          © 2026 Servicios Profesionales Tera · Todos los derechos reservados ·
          Ecuador
        </p>
        <p>Version 20.0 · Acceso Restringido · Entorno Operativo</p>
      </footer>
    </div>
  );
}
