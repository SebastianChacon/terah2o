"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSubscription } from "@/hooks/useSubscription";
import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { WHATSAPP_LINK } from "@/lib/constants";

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated } = useCurrentUser();
  const { isActive, isLoading: subLoading } = useSubscription();

  // Si el usuario ya tiene un plan activo/trial, no debe ver esta página:
  // se le envía directo a la aplicación.
  useEffect(() => {
    if (isAuthenticated && !subLoading && isActive) {
      router.replace("/operaciones");
    }
  }, [isAuthenticated, subLoading, isActive, router]);

  // Mientras se resuelve la suscripción de un usuario autenticado, evitar el
  // parpadeo del contenido antes del posible redirect.
  if (isAuthenticated && subLoading) {
    return (
      <div className="min-h-screen bg-[#05051a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05051a] text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(59,130,246,0.07)_0%,transparent_60%)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <Link
            href="/"
            className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
          <div className="text-center">
            <div className="text-[1.4rem] font-bold tracking-[0.04em]">
              <span className="text-white">TERA</span>
              <span className="text-blue-500">H2O</span>
            </div>
          </div>
          <div className="w-16" />
        </div>

        {/* Contenido */}
        <div className="max-w-md mx-auto text-center mt-10">
          <h1 className="text-3xl font-bold text-white mb-3">
            Activa tu plataforma
          </h1>
          <p className="text-white/40 text-sm leading-relaxed mb-8">
            Escríbenos por WhatsApp y un asesor activa tu cuenta TeraH2O a la
            medida de tu planta. Sin compromiso, cancela cuando quieras.
          </p>

          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="pricing-cta"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 hover:border-blue-500/50 text-blue-400 font-bold text-[0.72rem] uppercase tracking-[0.18em] rounded-lg transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            Contactar por WhatsApp
          </a>
        </div>

        {/* Footer */}
        <p className="text-center text-white/15 text-[0.62rem] font-mono mt-16 tracking-wide">
          © 2026 Servicios Profesionales Tera · Ecuador
        </p>
      </div>
    </div>
  );
}
