"use client";

import Link from "next/link";
import { Zap, FileBarChart, Package, DollarSign } from "lucide-react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Footer } from "@/components/layout/Footer";
import { NavbarUser } from "@/components/auth/NavbarUser";

const modules = [
  {
    href: "/operaciones/consola-tecnica",
    icon: <Zap className="w-5 h-5" />,
    title: "Consola Técnica",
    description: "Modelado de dosificación y optimización de jar-test.",
    iconColor: "text-sky-400",
    iconBg: "bg-sky-500/10",
    iconHoverBg: "group-hover:bg-sky-500",
  },
  {
    href: "/operaciones/hoja-operativa",
    icon: <FileBarChart className="w-5 h-5" />,
    title: "Hoja Operativa",
    description: "Registro de variables críticas y barreras sanitarias.",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    iconHoverBg: "group-hover:bg-blue-500",
  },
  {
    href: "/operaciones/stock",
    icon: <Package className="w-5 h-5" />,
    title: "Stock & Kardex",
    description: "Control de inventarios y autonomía operativa.",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/10",
    iconHoverBg: "group-hover:bg-violet-500",
  },
  {
    href: "/operaciones/finanzas",
    icon: <DollarSign className="w-5 h-5" />,
    title: "Finanzas PTAP",
    description: "Análisis de costos unitarios y proyecciones OPEX.",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
    iconHoverBg: "group-hover:bg-amber-500",
  },
];

export default function OperacionesPage() {
  return (
    <div className="dot-grid min-h-screen flex flex-col bg-navy-solid text-white">
      {/* Navbar */}
      <nav className="relative z-20 p-8 max-w-7xl mx-auto w-full flex justify-between items-center fade-in">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20"
          >
            T
          </Link>
        </div>
        <NavbarUser />
      </nav>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-6 fade-in">
        <div className="w-full max-w-4xl text-center space-y-12">
          <div className="space-y-4">
            <span className="inline-block px-3 py-1 bg-white/5 border border-white/10 text-sky-400 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]">
              PLATAFORMA DE OPTIMIZACIÓN Y CONTROL
            </span>
            <h1 className="text-2xl sm:text-4xl text-white font-extrabold uppercase tracking-tight">
              SISTEMA INTELIGENTE DE{" "}
              <br />
              <span className="text-sky-500">OPERACIÓN PTAP</span>
            </h1>
            <p className="text-slate-500 text-sm max-w-xl mx-auto font-medium">
              Arquitectura de datos para la gestión técnica y optimización de
              plantas de tratamiento de agua potable conforme a la NORMA INEN
              1108.
            </p>
          </div>

          {/* Module Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {modules.map((mod) => (
              <GlassPanel key={mod.href} {...mod} />
            ))}
          </div>

          {/* Bitácora link */}
          <div className="pt-8">
            <Link
              href="/operaciones/bitacora"
              className="text-white/40 hover:text-sky-400 transition-colors text-[10px] font-bold uppercase tracking-[0.3em] flex items-center gap-2 mx-auto justify-center group"
            >
              <span className="w-8 h-px bg-white/10 group-hover:bg-sky-400/50" />
              Bitácora Maestra
              <span className="w-8 h-px bg-white/10 group-hover:bg-sky-400/50" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
