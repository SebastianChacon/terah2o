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
  adminUserId: Id<"users">;
  ownerName: string | null;
  ownerEmail: string | null;
  adminCount: number;
  operatorCount: number;
  subscription: {
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    trialEndsAt: number | null;
    expiresAt: number | null;
  } | null;
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
}

export type OwnerView =
  | "dashboard"
  | "organizations"
  | "accounts"
  | "subscriptions";

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
