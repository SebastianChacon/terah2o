"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSubscription } from "@/hooks/useSubscription";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { getStatusColor, getPlanLabel } from "@/types/auth";
import Link from "next/link";
import { ArrowLeft, User, Building2, CreditCard, Calendar, Shield } from "lucide-react";

export default function ProfilePage() {
  const { user, isLoading } = useCurrentUser();
  const { subscription } = useSubscription();
  const myOrg = useQuery(api.organizations.getMyOrganization);

  const trialDaysLeft = useMemo(() => {
    if (!subscription?.trialEndsAt) return null;
    return Math.max(0, Math.ceil((subscription.trialEndsAt - new Date().getTime()) / (1000 * 60 * 60 * 24)));
  }, [subscription?.trialEndsAt]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#05051a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const statusColor = getStatusColor(subscription?.status);
  const planLabel = getPlanLabel(subscription?.plan, subscription?.status);

  return (
    <div className="min-h-screen bg-[#05051a] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.05)_0%,transparent_60%)]" />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-8">
        {/* Navbar */}
        <nav className="flex items-center justify-between mb-10">
          <Link
            href="/operaciones"
            className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
          <NavbarUser />
        </nav>

        <h1 className="text-2xl font-bold text-white mb-8">Mi Perfil</h1>

        {/* Card de usuario */}
        <div className="bg-[#0a1120] border border-white/[0.07] rounded-2xl p-6 mb-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 bg-blue-500/15 border border-blue-500/20 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{user?.name ?? "Sin nombre"}</p>
              <p className="text-white/40 text-sm font-mono">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow
              icon={Shield}
              label="Rol"
              value={user?.role === "admin" ? "Administrador" : "Operador"}
            />
            <InfoRow
              icon={Calendar}
              label="Miembro desde"
              value={user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("es-EC", { dateStyle: "medium" })
                : "—"}
            />
          </div>
        </div>

        {/* Card de organización */}
        {myOrg && (
          <div className="bg-[#0a1120] border border-white/[0.07] rounded-2xl p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h2 className="text-white/60 text-xs font-mono uppercase tracking-widest">
                Organización
              </h2>
            </div>
            <p className="text-white font-semibold mb-1">{myOrg.name}</p>
            <p className="text-white/30 text-xs font-mono">
              Capacidad: {myOrg.maxOperators} operadores máx.
            </p>
          </div>
        )}

        {/* Card de suscripción */}
        <div className="bg-[#0a1120] border border-white/[0.07] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-blue-400" />
            <h2 className="text-white/60 text-xs font-mono uppercase tracking-widest">
              Suscripción
            </h2>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor}`} />
            <div>
              <p className="text-white font-semibold">
                Plan {planLabel}
              </p>
              <p className="text-white/30 text-xs capitalize">
                {subscription?.status === "trialing" && trialDaysLeft !== null
                  ? `Prueba gratuita · ${trialDaysLeft} días restantes`
                  : subscription?.status === "active"
                  ? "Activo"
                  : subscription?.status === "past_due"
                  ? "Pago pendiente"
                  : subscription?.status === "canceled"
                  ? "Cancelado"
                  : "Sin suscripción activa"}
              </p>
            </div>
          </div>

          {(subscription?.status === "canceled" ||
            subscription?.status === "past_due" ||
            !subscription) && (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[0.7rem] font-mono uppercase tracking-widest rounded-lg hover:bg-blue-500/20 transition-all"
            >
              Activar plan →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
      <Icon className="w-3.5 h-3.5 text-white/20 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-white/25 text-[0.62rem] font-mono uppercase tracking-widest mb-0.5">
          {label}
        </p>
        <p className="text-white/70 text-xs">{value}</p>
      </div>
    </div>
  );
}
