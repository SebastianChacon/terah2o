"use client";

import Link from "next/link";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { CONTACT_PHONE_DISPLAY, WHATSAPP_LINK } from "@/lib/constants";

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#05051a] text-white overflow-x-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center brightness-[0.28]"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1584281722572-87002660d565?auto=format&fit=crop&w=1920&q=80')",
        }}
      />
      <div className="fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_40%,rgba(59,130,246,0.07)_0%,transparent_70%),linear-gradient(to_bottom,rgba(5,5,26,0.6)_0%,rgba(5,5,26,0.85)_100%)]" />

      <div className="relative z-[2] min-h-screen flex flex-col">
        {/* Top navbar con widget de usuario */}
        <div className="flex justify-end px-6 pt-4 animate-[fadeDown_0.8s_ease_both]">
          <NavbarUser />
        </div>

        {/* Header */}
        <header className="flex flex-col items-center pt-6 px-4 animate-[fadeDown_0.8s_ease_both]">
          <div className="text-[clamp(2rem,5vw,3rem)] font-bold tracking-[0.04em] leading-none">
            <span className="text-white">TERA</span>
            <span className="text-blue-500">H2O</span>
          </div>
          <p className="font-mono text-[0.72rem] tracking-[0.28em] text-white/45 mt-2 flex items-center gap-1.5">
            <span className="text-blue-500 text-[0.65rem]">✦</span>
            INTELIGENCIA OPERATIVA
          </p>
        </header>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 text-center">
          <p className="max-w-[480px] text-[0.92rem] leading-[1.75] text-white/70 font-light mb-11 animate-[fadeUp_0.9s_0.2s_ease_both] opacity-0">
            Infraestructura digital para la direccion tecnica y operativa de
            sistemas de agua potable.
            <br />
            Integra control, soporte especializado y formacion continua bajo un
            enfoque de eficiencia y excelencia operativa.
          </p>

          <div className="flex flex-wrap gap-3 justify-center animate-[fadeUp_0.9s_0.35s_ease_both] opacity-0">
            <NavLink href="/operaciones">Operaciones</NavLink>
            <NavLink href="/asistencia">Asistencia</NavLink>
            <NavLink href="/motor-inteligencia">
              Motor de Inteligencia Hidrometeorologica
            </NavLink>
            <NavLink href="/academia">Academia</NavLink>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-[2] text-center px-4 py-6 border-t border-white/[0.06] animate-[fadeUp_0.9s_0.5s_ease_both] opacity-0">
          <p className="text-[0.7rem] text-white/45 tracking-[0.03em] mb-1">
            © 2026 Servicios Profesionales Tera · Todos los derechos reservados
            · Ecuador, Version 20.0 · Acceso Restringido · Entorno Operativo
          </p>
          <p className="text-[0.7rem] text-blue-500 tracking-[0.02em]">
            <a
              href="mailto:teraserviciosprofesionales@outlook.com"
              className="hover:underline"
            >
              teraserviciosprofesionales@outlook.com
            </a>
            <span className="text-white/45 mx-1.5">·</span>
            07-573-0108
            <span className="text-white/45 mx-1.5">·</span>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {CONTACT_PHONE_DISPLAY}
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-5 py-2.5 font-mono text-[0.68rem] font-medium tracking-[0.2em] uppercase text-white bg-white/5 border border-white/[0.12] rounded-[3px] hover:border-blue-500 hover:bg-blue-500/[0.08] hover:text-blue-400 hover:shadow-[0_0_18px_rgba(59,130,246,0.18)] transition-all whitespace-nowrap"
    >
      {children}
    </Link>
  );
}
