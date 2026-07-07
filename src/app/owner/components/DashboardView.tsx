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
import { cardClass, primaryBtnClass, secondaryBtnClass } from "./shared";

interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  accent: string;
}

function MetricCard({ label, value, sublabel, icon, accent }: MetricCardProps) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#829ab1] text-[0.65rem] font-semibold uppercase tracking-wider">
          {label}
        </span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="text-3xl font-bold text-[#102a43] font-mono">{value}</div>
      {sublabel && <div className="text-[#829ab1] text-xs mt-1">{sublabel}</div>}
    </div>
  );
}

interface DashboardViewProps {
  onNavigate: (view: OwnerView) => void;
  onCreateClient: () => void;
  revHidden: boolean;
}

export function DashboardView({ onNavigate, onCreateClient, revHidden }: DashboardViewProps) {
  const m = useQuery(api.superAdmin.getOwnerDashboard) as OwnerMetrics | undefined;

  if (m === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#c4cfda] border-t-[#1666c4] rounded-full animate-spin" />
      </div>
    );
  }

  const activeSubs = m.subsByStatus.active;
  const trialing = m.subsByStatus.trialing;

  const alerts = [
    ...m.trialsExpiring.map((t) => ({
      organizationId: t.organizationId,
      orgName: t.orgName,
      date: t.trialEndsAt,
      label: "Prueba por vencer",
    })),
    ...m.activeExpiring.map((t) => ({
      organizationId: t.organizationId,
      orgName: t.orgName,
      date: t.expiresAt,
      label: "Suscripción por vencer",
    })),
  ].sort((a, b) => a.date - b.date);

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="bg-white border border-amber-200 border-l-4 border-l-amber-400 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="font-semibold text-sm text-amber-800">
              {alerts.length} {alerts.length === 1 ? "suscripción requiere" : "suscripciones requieren"} atención
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {alerts.slice(0, 5).map((a) => (
              <div key={`${a.organizationId}-${a.label}`} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 min-w-0 font-medium text-[#102a43] truncate">{a.orgName ?? "—"}</span>
                <span className="text-xs text-amber-700">{a.label}</span>
                <span className="font-mono text-xs text-amber-800">{formatDate(a.date)}</span>
                <button
                  onClick={() => onNavigate("clients")}
                  className="px-3 py-1 rounded-lg border border-amber-300 text-amber-800 text-xs font-medium hover:bg-amber-50 transition-colors"
                >
                  Abrir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="MRR estimado"
          value={revHidden ? "•••••" : `$${m.mrr.toLocaleString("en-US")}`}
          sublabel={`${activeSubs} suscripciones activas`}
          icon={<DollarSign className="w-4 h-4" />}
          accent="text-emerald-600"
        />
        <MetricCard
          label="Organizaciones"
          value={String(m.totalOrgs)}
          sublabel={`${trialing} en trial`}
          icon={<Building2 className="w-4 h-4" />}
          accent="text-[#1666c4]"
        />
        <MetricCard
          label="Cuentas"
          value={String(m.totalAccounts)}
          sublabel={`${m.totalAdmins} admin · ${m.totalOperators} op`}
          icon={<Users className="w-4 h-4" />}
          accent="text-violet-600"
        />
        <MetricCard
          label="Subs activas"
          value={String(activeSubs)}
          sublabel={`${m.subsByPlan.pro} pro · ${m.subsByPlan.starter} starter`}
          icon={<Activity className="w-4 h-4" />}
          accent="text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardClass} p-5`}>
          <h3 className="text-[#334e68] text-xs font-semibold uppercase tracking-wider mb-4">
            Estado de suscripciones
          </h3>
          <div className="space-y-2.5">
            {(
              [
                ["active", "Activas", "bg-emerald-500"],
                ["trialing", "En trial", "bg-amber-500"],
                ["past_due", "Vencidas", "bg-orange-500"],
                ["canceled", "Canceladas", "bg-red-500"],
              ] as const
            ).map(([key, label, dot]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  <span className="text-[#486581] text-sm">{label}</span>
                </div>
                <span className="text-[#102a43] font-mono text-sm">{m.subsByStatus[key]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClass} p-5`}>
          <h3 className="text-[#334e68] text-xs font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Vencimientos próximos (7 días)
          </h3>
          {alerts.length === 0 ? (
            <p className="text-[#829ab1] text-sm py-4 text-center">Ninguno próximo a vencer.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <button
                  key={`${a.organizationId}-${a.label}-mini`}
                  onClick={() => onNavigate("clients")}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[#f7f9fb] transition-colors text-left"
                >
                  <span className="text-[#486581] text-sm truncate">{a.orgName ?? "Sin nombre"}</span>
                  <span className="text-amber-700 text-xs font-mono shrink-0">{formatDate(a.date)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={onCreateClient} className={`${primaryBtnClass} flex items-center gap-2`}>
          <UserPlus className="w-4 h-4" />
          Nuevo cliente
        </button>
        <button onClick={() => onNavigate("clients")} className={`${secondaryBtnClass} flex items-center gap-2`}>
          <Building2 className="w-4 h-4" />
          Ver clientes
        </button>
      </div>
    </div>
  );
}
