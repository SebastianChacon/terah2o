"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Layers, Percent, GraduationCap } from "lucide-react";
import type { PlanRow, PricingConfigRow } from "../types";
import { cardClass, inputClass, labelClass, primaryBtnClass } from "./shared";

interface PlansViewProps {
  showToast: (msg: string, type: "success" | "error") => void;
}

function termPrices(monthly: number, pricing: PricingConfigRow | null | undefined) {
  const sixPct = pricing?.sixMonthDiscountPct ?? 0;
  const annPct = pricing?.annualDiscountPct ?? 0;
  return {
    six: Math.round(monthly * 6 * (1 - sixPct / 100)),
    annual: Math.round(monthly * 12 * (1 - annPct / 100)),
  };
}

function PlanCard({
  plan,
  pricing,
  showToast,
}: {
  plan: PlanRow;
  pricing: PricingConfigRow | null | undefined;
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

  const derived = termPrices(Number(price) || 0, pricing);

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

  const isAcademia = plan.type === "academia";

  return (
    <div className={`${cardClass} p-4 ${isAcademia ? "border-teal-200 bg-teal-50/30" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        {isAcademia ? (
          <GraduationCap className="w-4 h-4 text-teal-600" />
        ) : (
          <span className="font-mono text-[0.65rem] font-bold text-[#1666c4] bg-[#e8f1fc] rounded px-2 py-0.5">
            T{plan.order + 1}
          </span>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          className="flex-1 bg-transparent text-[#102a43] text-sm font-semibold focus:outline-none border-b border-transparent focus:border-[#1666c4]"
        />
      </div>
      {plan.blurb && <p className="text-[#829ab1] text-xs mb-3">{plan.blurb}</p>}

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className={labelClass}>Mensual (USD)</label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={busy}
            className={`${inputClass} font-mono font-semibold text-[#0f4c91]`}
          />
        </div>
        <div>
          <label className={labelClass}>6 meses · auto</label>
          <div className="px-3 py-2 bg-[#f7f9fb] border border-[#eef2f6] rounded-lg text-[#486581] font-mono text-sm font-semibold">
            ${derived.six.toLocaleString("en-US")}
          </div>
        </div>
        <div>
          <label className={labelClass}>Anual · auto</label>
          <div className="px-3 py-2 bg-[#f7f9fb] border border-[#eef2f6] rounded-lg text-[#486581] font-mono text-sm font-semibold">
            ${derived.annual.toLocaleString("en-US")}
          </div>
        </div>
      </div>

      {plan.type === "operaciones" && (
        <div className="bg-[#f7f9fb] rounded-lg p-3 mb-3">
          <label className={labelClass}>Rango de caudal asignado (L/s)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={caudalMin}
              onChange={(e) => setCaudalMin(e.target.value)}
              disabled={busy}
              className={`${inputClass} w-24 text-center`}
            />
            <span className="text-[#829ab1] text-xs">hasta</span>
            <input
              type="number"
              min={0}
              value={caudalMax}
              onChange={(e) => setCaudalMax(e.target.value)}
              disabled={busy}
              className={`${inputClass} w-24 text-center`}
            />
            <span className="text-[#829ab1] text-xs">L/s</span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={save} disabled={busy || !dirty} className={primaryBtnClass}>
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
    <div className="bg-[#0f2942] rounded-xl p-4 flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-2 text-white text-sm font-semibold">
        <Percent className="w-4 h-4 text-[#9fc1e8]" />
        Descuentos por contratación
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#9fc1e8]">6 meses</span>
        <div className="flex items-center bg-[#0b1f33] border border-[#1d3a57] rounded-lg overflow-hidden">
          <input
            value={sixMonth}
            onChange={(e) => setSixMonth(e.target.value)}
            type="number"
            disabled={busy}
            className="w-14 bg-transparent text-white px-2 py-1.5 font-mono text-center focus:outline-none"
          />
          <span className="px-2 text-[#7e9bba] text-xs">%</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#9fc1e8]">Anual</span>
        <div className="flex items-center bg-[#0b1f33] border border-[#1d3a57] rounded-lg overflow-hidden">
          <input
            value={annual}
            onChange={(e) => setAnnual(e.target.value)}
            type="number"
            disabled={busy}
            className="w-14 bg-transparent text-white px-2 py-1.5 font-mono text-center focus:outline-none"
          />
          <span className="px-2 text-[#7e9bba] text-xs">%</span>
        </div>
      </div>
      <button
        onClick={save}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-[#1666c4] text-white text-xs font-semibold hover:bg-[#0f4c91] disabled:opacity-40 transition-colors ml-auto"
      >
        {busy ? "Guardando…" : "Guardar descuentos"}
      </button>
    </div>
  );
}

export function PlansView({ showToast }: PlansViewProps) {
  const plans = useQuery(api.plans.listPlans) as PlanRow[] | undefined;
  const pricing = useQuery(api.plans.getPricingConfig) as PricingConfigRow | null | undefined;

  if (plans === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#c4cfda] border-t-[#1666c4] rounded-full animate-spin" />
      </div>
    );
  }

  const opsPlans = plans.filter((p) => p.type === "operaciones").sort((a, b) => a.order - b.order);
  const academiaPlans = plans.filter((p) => p.type === "academia");

  return (
    <div className="space-y-4">
      <p className="text-[#627d98] text-sm flex items-center gap-2">
        <Layers className="w-3.5 h-3.5" />
        Planes de Operaciones asignados por caudal · editable sin deploy
      </p>
      <DiscountsCard pricing={pricing} showToast={showToast} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {opsPlans.map((plan) => (
          <PlanCard key={plan._id} plan={plan} pricing={pricing} showToast={showToast} />
        ))}
      </div>
      {academiaPlans.map((plan) => (
        <PlanCard key={plan._id} plan={plan} pricing={pricing} showToast={showToast} />
      ))}
    </div>
  );
}
