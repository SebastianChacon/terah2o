"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Layers, Percent } from "lucide-react";
import type { PlanRow, PricingConfigRow } from "../types";

interface PlansViewProps {
  showToast: (msg: string, type: "success" | "error") => void;
}

function PlanCard({
  plan,
  showToast,
}: {
  plan: PlanRow;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const updatePlan = useMutation(api.superAdmin.updatePlan);
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [caudalMin, setCaudalMin] = useState(String(plan.caudalMin ?? ""));
  const [caudalMax, setCaudalMax] = useState(String(plan.caudalMax ?? ""));
  const [busy, setBusy] = useState(false);

  const dirty =
    name !== plan.name ||
    price !== String(plan.price) ||
    caudalMin !== String(plan.caudalMin ?? "") ||
    caudalMax !== String(plan.caudalMax ?? "");

  async function save() {
    setBusy(true);
    try {
      await updatePlan({
        planId: plan._id,
        name,
        price: Number(price),
        ...(plan.type === "operaciones"
          ? { caudalMin: Number(caudalMin), caudalMax: Number(caudalMax) }
          : {}),
      });
      showToast(`Plan "${name}" actualizado`, "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al guardar plan", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#0a1120] border border-white/7 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="w-4 h-4 text-amber-400/70" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          className="bg-transparent text-white text-sm font-semibold focus:outline-none border-b border-transparent focus:border-amber-500/40"
        />
        <span className="text-white/25 text-[0.6rem] font-mono uppercase tracking-widest ml-auto">
          {plan.type}
        </span>
      </div>
      {plan.blurb && <p className="text-white/35 text-xs mb-3">{plan.blurb}</p>}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
            Precio (USD/mes)
          </label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={busy}
            className="w-full px-2 py-1.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm focus:border-amber-500/40 focus:outline-none"
          />
        </div>
        {plan.type === "operaciones" && (
          <>
            <div>
              <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
                Caudal mín (L/s)
              </label>
              <input
                type="number"
                min={0}
                value={caudalMin}
                onChange={(e) => setCaudalMin(e.target.value)}
                disabled={busy}
                className="w-full px-2 py-1.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm focus:border-amber-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
                Caudal máx (L/s)
              </label>
              <input
                type="number"
                min={0}
                value={caudalMax}
                onChange={(e) => setCaudalMax(e.target.value)}
                disabled={busy}
                className="w-full px-2 py-1.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm focus:border-amber-500/40 focus:outline-none"
              />
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end mt-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 disabled:opacity-30 transition-all"
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

function DiscountsCard({
  pricing,
  showToast,
}: {
  pricing: PricingConfigRow | null | undefined;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const update = useMutation(api.superAdmin.updatePricingConfig);
  const [sixMonth, setSixMonth] = useState("");
  const [annual, setAnnual] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pricing) {
      setSixMonth(String(pricing.sixMonthDiscountPct));
      setAnnual(String(pricing.annualDiscountPct));
    }
  }, [pricing]);

  async function save() {
    setBusy(true);
    try {
      await update({
        sixMonthDiscountPct: Number(sixMonth),
        annualDiscountPct: Number(annual),
      });
      showToast("Descuentos actualizados", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al guardar", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#0a1120] border border-white/7 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Percent className="w-4 h-4 text-emerald-400/70" />
        <h3 className="text-white text-sm font-semibold">Descuentos por término</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
            6 meses (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={sixMonth}
            onChange={(e) => setSixMonth(e.target.value)}
            disabled={busy}
            className="w-full px-2 py-1.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
            Anual (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={annual}
            onChange={(e) => setAnnual(e.target.value)}
            disabled={busy}
            className="w-full px-2 py-1.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm focus:border-emerald-500/40 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <button
          onClick={save}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 disabled:opacity-30 transition-all"
        >
          {busy ? "Guardando…" : "Guardar descuentos"}
        </button>
      </div>
    </div>
  );
}

export function PlansView({ showToast }: PlansViewProps) {
  const plans = useQuery(api.plans.listPlans) as PlanRow[] | undefined;
  const pricing = useQuery(api.plans.getPricingConfig) as
    | PricingConfigRow
    | null
    | undefined;

  if (plans === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-white/25 text-xs font-mono">
        {plans.length} planes · editable sin deploy
      </p>
      <DiscountsCard pricing={pricing} showToast={showToast} />
      {plans
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((plan) => (
          <PlanCard key={plan._id} plan={plan} showToast={showToast} />
        ))}
    </div>
  );
}
