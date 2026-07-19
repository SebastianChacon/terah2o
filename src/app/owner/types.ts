import type { Id } from "../../../convex/_generated/dataModel";
import type {
  OperatorPermissions,
  SubscriptionStatus,
  SubscriptionPlan,
} from "@/types/auth";

// Fila de cuenta devuelta por api.superAdmin.listAllUsers
export interface AccountRow {
  _id: Id<"users">;
  name: string | null;
  email: string | null;
  clerkId: string | null;
  role: "admin" | "operator";
  organizationId: Id<"organizations"> | null;
  orgName: string | null;
  isOrgOwner: boolean;
  subStatus: string | null;
  subPlan: string | null;
  permissions: OperatorPermissions | null;
}

// Fila de organización devuelta por api.superAdmin.listOrganizations
export interface OrgRow {
  _id: Id<"organizations">;
  name: string;
  createdAt: number;
  maxOperators: number;
  maxAdmins: number;
  entitlements: OperatorPermissions;
  adminUserId: Id<"users">;
  ownerName: string | null;
  ownerEmail: string | null;
  adminCount: number;
  operatorCount: number;
  contractType: "directa" | "sercop" | null;
  contractNumber: string | null;
  contractMonths: number | null;
  plantProfile: {
    caudalLs: number;
    coagType: string;
    kgMonth: number;
    habitantes: number;
  } | null;
  contactCargo: string | null;
  contactPhone: string | null;
  region: string | null;
  address: string | null;
  subscription: {
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    planId: Id<"plans"> | null;
    trialEndsAt: number | null;
    expiresAt: number | null;
  } | null;
}

// Fila de plan devuelta por api.plans.listPlans
export interface PlanRow {
  _id: Id<"plans">;
  key: string;
  type: "operaciones" | "academia";
  name: string;
  price: number;
  caudalMin?: number;
  caudalMax?: number;
  blurb?: string;
  unlocks: OperatorPermissions;
  order: number;
}

export interface PricingConfigRow {
  _id: Id<"pricingConfig">;
  sixMonthDiscountPct: number;
  annualDiscountPct: number;
}

// Fila devuelta por api.superAdmin.listOwnerAuditLog
export interface AuditLogRow {
  _id: Id<"ownerAuditLog">;
  organizationId: Id<"organizations">;
  text: string;
  actorEmail: string;
  createdAt: number;
}

// Forma devuelta por api.superAdmin.getUsageAnalytics
export interface UsageAnalytics {
  totalEvents: number;
  daily: { date: string; count: number }[];
  monthly: { ym: string; count: number }[];
  byOrg: {
    organizationId: string;
    orgName: string;
    daily: { date: string; count: number }[];
    monthly: { ym: string; count: number }[];
  }[];
}

// Métricas devueltas por api.superAdmin.getOwnerDashboard
export interface OwnerMetrics {
  totalOrgs: number;
  totalAccounts: number;
  totalAdmins: number;
  totalOperators: number;
  subsByStatus: Record<SubscriptionStatus, number>;
  subsByPlan: Record<SubscriptionPlan, number>;
  mrr: number;
  trialsExpiring: {
    organizationId: string;
    orgName: string | null;
    trialEndsAt: number;
  }[];
  activeExpiring: {
    organizationId: string;
    orgName: string | null;
    expiresAt: number;
  }[];
}

export type OwnerView = "dashboard" | "clients" | "plans" | "usage" | "payments";

export const EMPTY_PERMS: OperatorPermissions = {
  canAccessOperaciones: false,
  canAccessAsistencia: false,
  canAccessAcademia: false,
  canAccessBitacora: false,
  canAccessConsolaTecnica: false,
  canAccessHojaOperativa: false,
  canAccessStock: false,
  canAccessFinanzas: false,
};

// ── Helpers de fecha (timestamp ↔ input[type=date]) ───────────────────────
export function toDateInput(ts: number | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

export function fromDateInput(value: string): number | undefined {
  if (!value) return undefined;
  const ts = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysLeft(ts: number | null | undefined): number | null {
  if (!ts) return null;
  return Math.round((ts - Date.now()) / 86_400_000);
}

export interface ClientStatus {
  key: "active" | "expiring" | "trial" | "expired" | "none";
  label: string;
  className: string;
}

// ── Estado comercial derivado de la suscripción de una organización ────────
// (misma lógica que el mockup: prueba > vencimiento del ciclo pagado > sin plan)
export function clientStatus(sub: OrgRow["subscription"]): ClientStatus {
  if (!sub) return { key: "none", label: "Sin plan", className: "bg-[#eef2f6] text-[#627d98]" };

  if (sub.status === "trialing") {
    const d = daysLeft(sub.trialEndsAt);
    if (d !== null && d < 0)
      return { key: "expired", label: "Prueba vencida", className: "bg-[#fee2e2] text-[#b91c1c]" };
    return {
      key: "trial",
      label: d !== null ? `Prueba · ${d}d` : "Prueba",
      className: "bg-[#fef3c7] text-[#b45309]",
    };
  }

  if (sub.status === "canceled")
    return { key: "expired", label: "Cancelada", className: "bg-[#fee2e2] text-[#b91c1c]" };
  if (sub.status === "past_due")
    return { key: "expired", label: "Vencida", className: "bg-[#fee2e2] text-[#b91c1c]" };

  const d = daysLeft(sub.expiresAt);
  if (d !== null && d < 0)
    return { key: "expired", label: "Vencida", className: "bg-[#fee2e2] text-[#b91c1c]" };
  if (d !== null && d <= 7)
    return { key: "expiring", label: `Por vencer · ${d}d`, className: "bg-[#ffedd5] text-[#c2410c]" };
  return { key: "active", label: "Activa", className: "bg-[#dcfce7] text-[#15803d]" };
}
