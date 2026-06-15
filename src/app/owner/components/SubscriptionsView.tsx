"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Building2, Save } from "lucide-react";
import type { SubscriptionStatus, SubscriptionPlan } from "@/types/auth";
import type { OrgRow } from "../types";
import { toDateInput, fromDateInput } from "../types";
import { SubBadge } from "./shared";

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "trialing", label: "Trial" },
  { value: "active", label: "Activa" },
  { value: "past_due", label: "Vencida" },
  { value: "canceled", label: "Cancelada" },
];

const PLAN_OPTIONS: { value: SubscriptionPlan; label: string }[] = [
  { value: "starter", label: "Starter ($49)" },
  { value: "pro", label: "Pro ($89)" },
];

interface SubscriptionsViewProps {
  showToast: (msg: string, type: "success" | "error") => void;
}

function darkSelect(extra = "") {
  return `w-full px-3 py-2 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm focus:border-amber-500/40 focus:outline-none transition-colors ${extra}`;
}

function SubscriptionEditor({
  org,
  showToast,
}: {
  org: OrgRow;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const setSub = useMutation(api.superAdmin.setSubscriptionGlobal);
  const [status, setStatus] = useState<SubscriptionStatus>(
    org.subscription?.status ?? "trialing"
  );
  const [plan, setPlan] = useState<SubscriptionPlan>(
    org.subscription?.plan ?? "starter"
  );
  const [trialEndsAt, setTrialEndsAt] = useState(
    toDateInput(org.subscription?.trialEndsAt)
  );
  const [expiresAt, setExpiresAt] = useState(
    toDateInput(org.subscription?.expiresAt)
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await setSub({
        organizationId: org._id,
        status,
        plan,
        trialEndsAt: fromDateInput(trialEndsAt),
        expiresAt: fromDateInput(expiresAt),
      });
      showToast(`Suscripción de ${org.name} actualizada`, "success");
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Error al guardar suscripción",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 bg-[#0a1120] border border-white/7 rounded-xl">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-blue-400/70 shrink-0" />
          <span className="text-white text-sm font-semibold truncate">
            {org.name}
          </span>
        </div>
        <SubBadge
          status={org.subscription?.status}
          plan={org.subscription?.plan}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
            Estado
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
            className={darkSelect()}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
            Plan
          </label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
            className={darkSelect()}
          >
            {PLAN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
            Fin de trial
          </label>
          <input
            type="date"
            value={trialEndsAt}
            onChange={(e) => setTrialEndsAt(e.target.value)}
            className={darkSelect("[color-scheme:dark]")}
          />
        </div>
        <div>
          <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
            Vencimiento
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={darkSelect("[color-scheme:dark]")}
          />
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider hover:bg-amber-500/25 disabled:opacity-50 transition-all"
        >
          {saving ? (
            <div className="w-3.5 h-3.5 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Guardar
        </button>
      </div>
    </div>
  );
}

export function SubscriptionsView({ showToast }: SubscriptionsViewProps) {
  const orgs = useQuery(api.superAdmin.listOrganizations) as
    | OrgRow[]
    | undefined;

  if (orgs === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-white/30 text-sm mb-2">
        Palanca comercial: cambia plan, estado y fechas para activar o suspender
        el acceso de cada organización.
      </p>
      {orgs.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          No hay organizaciones todavía.
        </div>
      ) : (
        orgs.map((org) => (
          <SubscriptionEditor key={org._id} org={org} showToast={showToast} />
        ))
      )}
    </div>
  );
}
