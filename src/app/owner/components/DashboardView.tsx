"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Building2,
  Users,
  DollarSign,
  Activity,
  AlertTriangle,
  UserPlus,
} from "lucide-react";
import type { OwnerMetrics, OwnerView } from "../types";
import { formatDate } from "../types";

interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  accent: string;
}

function MetricCard({ label, value, sublabel, icon, accent }: MetricCardProps) {
  return (
    <div className="p-5 bg-[#0a1120] border border-white/[0.07] rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/30 text-[0.6rem] font-mono uppercase tracking-widest">
          {label}
        </span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      {sublabel && (
        <div className="text-white/30 text-xs mt-1">{sublabel}</div>
      )}
    </div>
  );
}

interface DashboardViewProps {
  onNavigate: (view: OwnerView) => void;
  onCreateClient: () => void;
}

export function DashboardView({ onNavigate, onCreateClient }: DashboardViewProps) {
  const m = useQuery(api.superAdmin.getOwnerDashboard) as OwnerMetrics | undefined;

  if (m === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  const activeSubs = m.subsByStatus.active;
  const trialing = m.subsByStatus.trialing;

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="MRR estimado"
          value={`$${m.mrr.toLocaleString("en-US")}`}
          sublabel={`${activeSubs} suscripciones activas`}
          icon={<DollarSign className="w-4 h-4" />}
          accent="text-emerald-400"
        />
        <MetricCard
          label="Organizaciones"
          value={String(m.totalOrgs)}
          sublabel={`${trialing} en trial`}
          icon={<Building2 className="w-4 h-4" />}
          accent="text-blue-400"
        />
        <MetricCard
          label="Cuentas"
          value={String(m.totalAccounts)}
          sublabel={`${m.totalAdmins} admin · ${m.totalOperators} op`}
          icon={<Users className="w-4 h-4" />}
          accent="text-violet-400"
        />
        <MetricCard
          label="Subs activas"
          value={String(activeSubs)}
          sublabel={`${m.subsByPlan.pro} pro · ${m.subsByPlan.starter} starter`}
          icon={<Activity className="w-4 h-4" />}
          accent="text-amber-400"
        />
      </div>

      {/* Estado de suscripciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 bg-[#0a1120] border border-white/[0.07] rounded-2xl">
          <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">
            Estado de suscripciones
          </h3>
          <div className="space-y-2.5">
            {(
              [
                ["active", "Activas", "bg-emerald-400"],
                ["trialing", "En trial", "bg-amber-400"],
                ["past_due", "Vencidas", "bg-orange-400"],
                ["canceled", "Canceladas", "bg-red-400"],
              ] as const
            ).map(([key, label, dot]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  <span className="text-white/50 text-sm">{label}</span>
                </div>
                <span className="text-white font-mono text-sm">
                  {m.subsByStatus[key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trials por vencer */}
        <div className="p-5 bg-[#0a1120] border border-white/[0.07] rounded-2xl">
          <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400/70" />
            Trials por vencer (7 días)
          </h3>
          {m.trialsExpiring.length === 0 ? (
            <p className="text-white/25 text-sm py-4 text-center">
              Ninguno próximo a vencer.
            </p>
          ) : (
            <div className="space-y-2">
              {m.trialsExpiring.map((t) => (
                <button
                  key={t.organizationId}
                  onClick={() => onNavigate("subscriptions")}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                >
                  <span className="text-white/60 text-sm truncate">
                    {t.orgName ?? "Sin nombre"}
                  </span>
                  <span className="text-amber-300/80 text-xs font-mono shrink-0">
                    {formatDate(t.trialEndsAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onCreateClient}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm font-semibold hover:bg-amber-500/25 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo cliente
        </button>
        <button
          onClick={() => onNavigate("organizations")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white/60 text-sm font-semibold hover:border-white/25 transition-all"
        >
          <Building2 className="w-4 h-4" />
          Ver organizaciones
        </button>
        <button
          onClick={() => onNavigate("subscriptions")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-white/60 text-sm font-semibold hover:border-white/25 transition-all"
        >
          <DollarSign className="w-4 h-4" />
          Gestionar suscripciones
        </button>
      </div>
    </div>
  );
}
