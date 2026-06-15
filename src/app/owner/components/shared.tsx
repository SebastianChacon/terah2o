import type { SubscriptionStatus, SubscriptionPlan } from "@/types/auth";

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  trialing: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  past_due: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  canceled: "bg-red-500/15 text-red-300 border-red-500/30",
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
      <span className="text-[0.55rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border bg-white/5 text-white/30 border-white/10">
        Sin plan
      </span>
    );
  }
  return (
    <span
      className={`text-[0.55rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
      {plan ? ` · ${plan}` : ""}
    </span>
  );
}

export function RoleBadge({ isAdmin }: { isAdmin: boolean }) {
  return (
    <span
      className={`shrink-0 text-[0.55rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
        isAdmin
          ? "bg-violet-500/15 text-violet-300"
          : "bg-blue-500/15 text-blue-300"
      }`}
    >
      {isAdmin ? "Admin" : "Operador"}
    </span>
  );
}

export function OwnerBadge() {
  return (
    <span className="shrink-0 text-[0.55rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
      Dueño
    </span>
  );
}
