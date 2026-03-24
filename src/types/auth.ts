import type { Id } from "../../convex/_generated/dataModel";

// ── Roles ─────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "operator";

// ── Estados de suscripción ────────────────────────────────────────────────
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type SubscriptionPlan = "starter" | "pro";

// ── Perfil de usuario (tabla users) ───────────────────────────────────────
export interface UserProfile {
  _id: Id<"users">;
  tokenIdentifier: string;
  email: string;
  name?: string;
  role: UserRole;
  organizationId?: Id<"organizations">;
  createdAt: number;
}

// ── Organización ──────────────────────────────────────────────────────────
export interface Organization {
  _id: Id<"organizations">;
  name: string;
  adminUserId: Id<"users">;
  maxOperators: number;
}

// ── Suscripción ───────────────────────────────────────────────────────────
export interface Subscription {
  _id: Id<"subscriptions">;
  organizationId: Id<"organizations">;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  trialEndsAt?: number;
  expiresAt?: number;
  createdAt: number;
}

// ── Permisos de operador ──────────────────────────────────────────────────
export interface OperatorPermissions {
  canAccessOperaciones: boolean;
  canAccessAsistencia: boolean;
  canAccessAcademia: boolean;
  canAccessBitacora: boolean;
}

// Clave de permiso individual (para usar en AuthGuard)
export type PermissionKey = keyof OperatorPermissions;

// ── Helper: color del dot de estado ──────────────────────────────────────
export function getStatusColor(status?: SubscriptionStatus): string {
  switch (status) {
    case "active":
      return "bg-emerald-500";
    case "trialing":
      return "bg-amber-500";
    case "past_due":
      return "bg-orange-500";
    case "canceled":
      return "bg-red-500";
    default:
      return "bg-white/20";
  }
}

// ── Helper: etiqueta de plan ──────────────────────────────────────────────
export function getPlanLabel(plan?: SubscriptionPlan, status?: SubscriptionStatus): string {
  if (!status || status === "canceled") return "SIN PLAN";
  if (status === "trialing") return "TRIAL";
  return plan?.toUpperCase() ?? "PLAN";
}
