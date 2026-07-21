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
  maxAdmins?: number;
  // Entitlements de pagina a nivel organizacion (controlados por el Owner).
  canAccessOperaciones?: boolean;
  canAccessAsistencia?: boolean;
  canAccessAcademia?: boolean;
  canAccessBitacora?: boolean;
  canAccessConsolaTecnica?: boolean;
  canAccessHojaOperativa?: boolean;
  canAccessStock?: boolean;
  canAccessFinanzas?: boolean;
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
  // Top-level modules
  canAccessOperaciones: boolean;
  canAccessAsistencia: boolean;
  canAccessAcademia: boolean;
  canAccessBitacora: boolean;
  // Sub-modules within /operaciones
  canAccessConsolaTecnica: boolean;
  canAccessHojaOperativa: boolean;
  canAccessStock: boolean;
  canAccessFinanzas: boolean;
}

// Clave de permiso individual (para usar en AuthGuard)
export type PermissionKey = keyof OperatorPermissions;

// Lista canonica de las 8 llaves de modulo. Fuente unica para cliente y servidor.
export const MODULE_PERMISSION_KEYS: PermissionKey[] = [
  "canAccessOperaciones",
  "canAccessAsistencia",
  "canAccessAcademia",
  "canAccessBitacora",
  "canAccessConsolaTecnica",
  "canAccessHojaOperativa",
  "canAccessStock",
  "canAccessFinanzas",
];

// Sub-modulos de /operaciones: requieren ademas canAccessOperaciones.
export const OPERACIONES_SUBMODULE_KEYS: PermissionKey[] = [
  "canAccessConsolaTecnica",
  "canAccessHojaOperativa",
  "canAccessStock",
  "canAccessFinanzas",
];

/**
 * Normaliza un set de permisos: si Operaciones (hub) esta apagado, los 4
 * sub-modulos quedan apagados.
 */
export function normalizePerms(p: OperatorPermissions): OperatorPermissions {
  const ops = p.canAccessOperaciones === true;
  return {
    canAccessOperaciones: ops,
    canAccessAsistencia: p.canAccessAsistencia === true,
    canAccessAcademia: p.canAccessAcademia === true,
    canAccessBitacora: p.canAccessBitacora === true,
    canAccessConsolaTecnica: ops && p.canAccessConsolaTecnica === true,
    canAccessHojaOperativa: ops && p.canAccessHojaOperativa === true,
    canAccessStock: ops && p.canAccessStock === true,
    canAccessFinanzas: ops && p.canAccessFinanzas === true,
  };
}

/**
 * Topa `requested` contra `cap` (entitlements de la org): resultado[k] =
 * requested[k] && cap[k]. Garantiza que nadie exceda lo que la org tiene.
 */
export function clampPerms(
  requested: OperatorPermissions,
  cap: OperatorPermissions
): OperatorPermissions {
  const out = {} as OperatorPermissions;
  for (const k of MODULE_PERMISSION_KEYS) {
    out[k] = requested[k] === true && cap[k] === true;
  }
  return normalizePerms(out);
}

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
