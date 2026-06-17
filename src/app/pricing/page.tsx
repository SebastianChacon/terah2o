"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSubscription } from "@/hooks/useSubscription";
import Link from "next/link";
import { Check, Zap, Shield, Star, ArrowLeft, MessageCircle } from "lucide-react";
import { WHATSAPP_LINK, WHATSAPP_NUMBER } from "@/lib/constants";

/** Enlace de WhatsApp con mensaje pre-llenado para contratar un plan específico. */
function planWhatsappLink(planName: string, price: string): string {
  const msg = `Hola TeraH2O, quiero contratar el plan ${planName} (${price}/mes). ¿Me ayudan con la activación?`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$49",
    period: "/mes",
    description: "Ideal para plantas pequenas y medianas",
    color: "border-white/10",
    accentColor: "text-blue-400",
    badgeColor: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    features: [
      "1 Admin + hasta 3 Operadores",
      "Operaciones: Consola, Hoja, Stock",
      "Finanzas PTAP basica",
      "Motor IA Hidrometeorologica",
      "Academia (Modulos I-II)",
      "Soporte por email",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$89",
    period: "/mes",
    description: "Para plantas con operacion intensiva",
    color: "border-blue-500/30",
    accentColor: "text-blue-400",
    badgeColor: "bg-blue-500/20 border-blue-500/40 text-blue-300",
    badge: "MAS POPULAR",
    features: [
      "1 Admin + hasta 5 Operadores",
      "Acceso completo a Operaciones",
      "Asistencia Tecnica multicliente",
      "Bitacora Maestra + Auditoria",
      "Academia completa (I-IV)",
      "Motor IA + prediccion avanzada",
      "Soporte prioritario WhatsApp",
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated } = useCurrentUser();
  const { isActive, isLoading: subLoading } = useSubscription();

  // Si el usuario ya tiene un plan activo/trial, no debe ver los planes:
  // se le envía directo a la aplicación.
  useEffect(() => {
    if (isAuthenticated && !subLoading && isActive) {
      router.replace("/operaciones");
    }
  }, [isAuthenticated, subLoading, isActive, router]);

  // Mientras se resuelve la suscripción de un usuario autenticado, evitar el
  // parpadeo de los planes antes del posible redirect.
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

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">Planes y Precios</h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-md mx-auto">
            Escribenos por WhatsApp y un asesor activa tu plan. Sin compromiso, cancela cuando quieras.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`bg-[#0a1120] border ${plan.color} rounded-2xl p-6 flex flex-col`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className={`self-start mb-4 px-3 py-1 border rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${plan.badgeColor}`}>
                  {plan.badge}
                </div>
              )}

              {/* Plan header */}
              <div className="mb-5">
                <h2 className="text-white font-bold text-xl mb-1">{plan.name}</h2>
                <p className="text-white/30 text-xs">{plan.description}</p>
                <div className="flex items-baseline gap-1 mt-3">
                  <span className={`text-3xl font-bold ${plan.accentColor}`}>{plan.price}</span>
                  <span className="text-white/30 text-sm">{plan.period}</span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                    {feature.includes("WhatsApp") ? (
                      <a
                        href={WHATSAPP_LINK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-xs leading-relaxed hover:underline"
                      >
                        {feature}
                      </a>
                    ) : (
                      <span className="text-white/60 text-xs leading-relaxed">{feature}</span>
                    )}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href={planWhatsappLink(plan.name, plan.price)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`plan-cta-${plan.id}`}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 hover:border-blue-500/50 text-blue-400 font-bold text-[0.72rem] uppercase tracking-[0.18em] rounded-lg transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Ponerse en contacto
              </a>
            </div>
          ))}
        </div>

        {/* Features grid */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            { icon: Zap, title: "Activacion instantanea", desc: "Empieza a usar la plataforma en segundos" },
            { icon: Shield, title: "Sin compromiso", desc: "Cancela en cualquier momento sin penalizaciones" },
            { icon: Star, title: "Soporte tecnico", desc: "Asesoria de ingenieros especializados en PTAP" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-white/70 text-xs font-semibold mb-1">{title}</p>
              <p className="text-white/30 text-[0.68rem] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-white/15 text-[0.62rem] font-mono mt-12 tracking-wide">
          © 2026 Servicios Profesionales Tera · Ecuador
        </p>
      </div>
    </div>
  );
}
