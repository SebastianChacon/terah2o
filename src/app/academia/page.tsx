import Link from "next/link";
import { BookOpen, Filter, Shield, Settings, GraduationCap } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

const modules = [
  {
    href: "/academia/modulo-1",
    number: "I - II.1",
    title: "Fundamentos de Potabilización",
    description:
      "Introducción a la ingeniería de tratamiento, coagulación y jar-test.",
    icon: <BookOpen className="w-5 h-5" />,
    color: "border-sky-500",
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-400",
  },
  {
    href: "/academia/modulo-2-filtracion",
    number: "II.2",
    title: "Ingeniería de Filtración",
    description:
      "Diseño de lechos filtrantes, cinética y dimensionamiento hidráulico.",
    icon: <Filter className="w-5 h-5" />,
    color: "border-cyan-500",
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
  },
  {
    href: "/academia/modulo-2-desinfeccion",
    number: "II.3",
    title: "Inactivación Microbiológica",
    description:
      "Desinfección, seguridad NFPA y protocolos de cloración.",
    icon: <Shield className="w-5 h-5" />,
    color: "border-emerald-500",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
  },
  {
    href: "/academia/modulo-3",
    number: "III",
    title: "Operación y Control",
    description:
      "Monitoreo analítico, inyección química y control de procesos.",
    icon: <Settings className="w-5 h-5" />,
    color: "border-violet-500",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
  },
  {
    href: "/academia/modulo-4",
    number: "IV",
    title: "Gestión Avanzada",
    description:
      "Patologías, membranas, ROI y sostenibilidad hídrica.",
    icon: <GraduationCap className="w-5 h-5" />,
    color: "border-amber-500",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
  },
];

export default function AcademiaPage() {
  return (
    <div className="dot-grid min-h-screen flex flex-col bg-[#0a1120] text-white">
      {/* Nav */}
      <nav className="p-8 max-w-7xl mx-auto w-full flex justify-between items-center fade-in">
        <Link
          href="/"
          className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20"
        >
          T
        </Link>
        <div className="text-white/30 text-[10px] font-medium uppercase tracking-[0.2em] text-right">
          ACADEMIA
          <br />
          CAPACITACIÓN PROFESIONAL
        </div>
      </nav>

      {/* Header */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 space-y-12 fade-in">
        <div className="text-center space-y-4">
          <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 text-sky-400 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]">
            PROGRAMA DE FORMACIÓN TÉCNICA
          </span>
          <h1 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight">
            Ingeniería de{" "}
            <span className="text-sky-500">Potabilización Profesional</span>
          </h1>
          <p className="text-slate-500 text-sm max-w-xl mx-auto font-medium">
            Ruta formativa completa para la gestión técnica y operativa de
            plantas de tratamiento de agua potable bajo estándares INEN 1108,
            AWWA y CEPIS.
          </p>
        </div>

        {/* Module Roadmap */}
        <div className="space-y-4">
          {modules.map((mod, idx) => (
            <Link
              key={mod.href}
              href={mod.href}
              className={`group block glass-panel p-6 border-l-4 ${mod.color} hover:border-l-4`}
            >
              <div className="flex items-start gap-5">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`w-10 h-10 ${mod.iconBg} ${mod.iconColor} rounded-lg flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition-all`}
                  >
                    {mod.icon}
                  </div>
                  {idx < modules.length - 1 && (
                    <div className="w-px h-6 bg-white/10" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                      Módulo {mod.number}
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-sm mb-1 group-hover:text-sky-400 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-slate-500 text-[11px] font-medium leading-relaxed">
                    {mod.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
