"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import Link from "next/link";
import { Check, Zap, Shield, Star, ArrowLeft } from "lucide-react";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$49",
    period: "/mes",
    description: "Ideal para plantas pequeñas y medianas",
    color: "border-white/10",
    accentColor: "text-blue-400",
    badgeColor: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    features: [
      "1 Admin + hasta 3 Operadores",
      "Operaciones: Consola, Hoja, Stock",
      "Finanzas PTAP básica",
      "Motor IA Hidrometeorológica",
      "Academia (Módulos I-II)",
      "Soporte por email",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$89",
    period: "/mes",
    description: "Para plantas con operación intensiva",
    color: "border-blue-500/30",
    accentColor: "text-blue-400",
    badgeColor: "bg-blue-500/20 border-blue-500/40 text-blue-300",
    badge: "MÁS POPULAR",
    features: [
      "1 Admin + hasta 5 Operadores",
      "Acceso completo a Operaciones",
      "Asistencia Técnica multicliente",
      "Bitácora Maestra + Auditoría",
      "Academia completa (I-IV)",
      "Motor IA + predicción avanzada",
      "Soporte prioritario WhatsApp",
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const myOrg = useQuery(api.organizations.getMyOrganization);
  const createOrg = useMutation(api.organizations.createOrganization);
  const createTrial = useMutation(api.subscriptions.createTrialSubscription);

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectPlan(planId: "starter" | "pro") {
    if (!user) {
      router.push("/login?next=/pricing");
      return;
    }

    setLoading(planId);
    setError(null);

    try {
      // Crear organización si no existe
      let orgId = myOrg?._id;
      if (!orgId) {
        orgId = await createOrg({ name: `Organización de ${user.name ?? user.email}` });
      }

      // Activar trial
      await createTrial({ organizationId: orgId, plan: planId });

      // Escribir cookie de estado para el middleware
      document.cookie = `__convexSubStatus=trialing;path=/;max-age=${60 * 60};SameSite=Lax`;

      router.push("/operaciones");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al activar el plan");
    } finally {
      setLoading(null);
    }
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
            14 días de prueba gratuita en cualquier plan. Sin tarjeta de crédito requerida.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 max-w-md mx-auto">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

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
                    <span className="text-white/60 text-xs leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading !== null || userLoading}
                className="w-full py-3 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25 hover:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 font-bold text-[0.72rem] uppercase tracking-[0.18em] rounded-lg transition-all"
              >
                {loading === plan.id
                  ? "Activando..."
                  : "Iniciar prueba gratis — 14 días"}
              </button>
            </div>
          ))}
        </div>

        {/* Features grid */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            { icon: Zap, title: "Activación instantánea", desc: "Empieza a usar la plataforma en segundos" },
            { icon: Shield, title: "Sin compromiso", desc: "Cancela en cualquier momento sin penalizaciones" },
            { icon: Star, title: "Soporte técnico", desc: "Asesoría de ingenieros especializados en PTAP" },
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
