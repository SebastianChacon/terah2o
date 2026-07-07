import type { SubscriptionStatus, SubscriptionPlan } from "@/types/auth";

// ── Tema claro compartido por todo /owner (ver Hidrica Console Admin.html) ─
export const cardClass = "bg-white border border-[#dde4ec] rounded-xl";
export const inputClass =
  "w-full px-3 py-2 bg-white border border-[#c4cfda] rounded-lg text-[#102a43] text-sm placeholder:text-[#829ab1] focus:border-[#1666c4] focus:outline-none transition-colors disabled:opacity-50";
export const labelClass =
  "block text-[#829ab1] text-[0.65rem] font-semibold uppercase tracking-wider mb-1.5";
export const primaryBtnClass =
  "px-4 py-2 rounded-lg bg-[#1666c4] text-white text-sm font-semibold hover:bg-[#0f4c91] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const secondaryBtnClass =
  "px-4 py-2 rounded-lg border border-[#c4cfda] text-[#486581] text-sm font-medium hover:border-[#1666c4] hover:text-[#0f4c91] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const dangerBtnClass =
  "px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  active: "bg-[#dcfce7] text-[#15803d]",
  trialing: "bg-[#fef3c7] text-[#b45309]",
  past_due: "bg-[#ffedd5] text-[#c2410c]",
  canceled: "bg-[#fee2e2] text-[#b91c1c]",
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Activa",
  trialing: "Trial",
  past_due: "Vencida",
  canceled: "Cancelada",
};

export function SubBadge({
  status,
  plan,
}: {
  status: SubscriptionStatus | null | undefined;
  plan?: SubscriptionPlan | null;
}) {
  if (!status) {
    return (
      <span className="text-[0.7rem] font-semibold px-2.5 py-1 rounded-full bg-[#eef2f6] text-[#627d98]">
        Sin plan
      </span>
    );
  }
  return (
    <span
      className={`text-[0.7rem] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
      {plan ? ` · ${plan}` : ""}
    </span>
  );
}

export function RoleBadge({ isAdmin }: { isAdmin: boolean }) {
  return (
    <span
      className={`shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${
        isAdmin
          ? "bg-violet-100 text-violet-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {isAdmin ? "Admin" : "Operador"}
    </span>
  );
}

export function OwnerBadge() {
  return (
    <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-100 text-amber-700">
      Dueño
    </span>
  );
}
