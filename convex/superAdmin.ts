// convex/superAdmin.ts
// Panel Owner (super-admin global). Gate por SUPER_ADMIN_EMAIL (un solo correo).
// Alcance GLOBAL: ve y administra cuentas de TODAS las organizaciones.
// El gate vive 100% en el backend: nunca confiar en el cliente.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthenticatedUser } from "./lib/auth";

type AnyCtx = QueryCtx | MutationCtx;

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Devuelve el correo del super-admin configurado, o "" si no hay env var.
 * Lee process.env en el backend de Convex (configurar en Convex Dashboard).
 */
function superAdminEmail(): string {
  return normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
}

/**
 * true si el usuario autenticado es el super-admin. No lanza.
 */
async function isSuperAdmin(ctx: AnyCtx): Promise<boolean> {
  const allowed = superAdminEmail();
  if (!allowed) return false; // sin env var configurada → nadie es owner

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;

  const user = await getAuthenticatedUser(ctx);
  const callerEmail = normalizeEmail(user?.email ?? identity.email);
  return callerEmail !== "" && callerEmail === allowed;
}

/**
 * Lanza si el usuario autenticado no es el super-admin.
 */
async function requireSuperAdmin(ctx: AnyCtx): Promise<void> {
  if (!(await isSuperAdmin(ctx))) throw new Error("No autorizado");
}

// ── ¿Soy el super-admin? (gate de UI, no lanza) ───────────────────────────
export const amISuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    return await isSuperAdmin(ctx);
  },
});

// ── Listar TODAS las cuentas del sistema (global) ─────────────────────────
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const orgs = await ctx.db.query("organizations").collect();
    const subs = await ctx.db.query("subscriptions").collect();
    const perms = await ctx.db.query("operatorPermissions").collect();

    const orgById = new Map(orgs.map((o) => [o._id, o]));
    const subByOrg = new Map(subs.map((s) => [s.organizationId, s]));
    const permByOperator = new Map(perms.map((p) => [p.operatorId, p]));

    return users.map((u) => {
      const org = u.organizationId ? orgById.get(u.organizationId) : undefined;
      const sub = u.organizationId ? subByOrg.get(u.organizationId) : undefined;
      const perm = permByOperator.get(u._id);
      const role = u.role ?? "operator"; // sin rol → tratado como operador

      return {
        _id: u._id,
        name: u.name ?? null,
        email: u.email ?? null,
        clerkId: u.clerkId ?? null,
        role,
        organizationId: u.organizationId ?? null,
        orgName: org?.name ?? null,
        isOrgOwner: org ? org.adminUserId === u._id : false,
        subStatus: sub?.status ?? null,
        subPlan: sub?.plan ?? null,
        permissions:
          role === "operator"
            ? {
                canAccessOperaciones: perm?.canAccessOperaciones ?? false,
                canAccessAsistencia: perm?.canAccessAsistencia ?? false,
                canAccessAcademia: perm?.canAccessAcademia ?? false,
                canAccessBitacora: perm?.canAccessBitacora ?? false,
                canAccessConsolaTecnica: perm?.canAccessConsolaTecnica ?? false,
                canAccessHojaOperativa: perm?.canAccessHojaOperativa ?? false,
                canAccessStock: perm?.canAccessStock ?? false,
                canAccessFinanzas: perm?.canAccessFinanzas ?? false,
              }
            : null, // admins tienen acceso total por diseño (AuthGuard)
      };
    });
  },
});

// ── Fijar permisos de cualquier operador (sin filtro de org) ──────────────
export const setPermissionsGlobal = mutation({
  args: {
    operatorId: v.id("users"),
    canAccessOperaciones: v.boolean(),
    canAccessAsistencia: v.boolean(),
    canAccessAcademia: v.boolean(),
    canAccessBitacora: v.boolean(),
    canAccessConsolaTecnica: v.optional(v.boolean()),
    canAccessHojaOperativa: v.optional(v.boolean()),
    canAccessStock: v.optional(v.boolean()),
    canAccessFinanzas: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const operator = await ctx.db.get(args.operatorId);
    if (!operator) throw new Error("Usuario no encontrado");
    if (!operator.organizationId)
      throw new Error("El usuario no tiene organización asignada");

    const existing = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .unique();

    const permsData = {
      operatorId: args.operatorId,
      organizationId: operator.organizationId,
      canAccessOperaciones: args.canAccessOperaciones,
      canAccessAsistencia: args.canAccessAsistencia,
      canAccessAcademia: args.canAccessAcademia,
      canAccessBitacora: args.canAccessBitacora,
      canAccessConsolaTecnica: args.canAccessConsolaTecnica ?? false,
      canAccessHojaOperativa: args.canAccessHojaOperativa ?? false,
      canAccessStock: args.canAccessStock ?? false,
      canAccessFinanzas: args.canAccessFinanzas ?? false,
    };

    if (existing) {
      await ctx.db.patch(existing._id, permsData);
      return existing._id;
    }
    return await ctx.db.insert("operatorPermissions", permsData);
  },
});

// ── Eliminar cualquier cuenta (global) ────────────────────────────────────
// Reglas de seguridad: no borrar al propio super-admin ni al dueño de una org.
// Devuelve { clerkId, email } para que la API route borre la cuenta Clerk.
export const deleteUserGlobal = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Usuario no encontrado");

    // No permitir que el owner se elimine a sí mismo
    const me = await getAuthenticatedUser(ctx);
    if (me && me._id === target._id)
      throw new Error("No puedes eliminar tu propia cuenta de super-admin");

    // No permitir orfanar una organización (su admin dueño)
    if (target.organizationId) {
      const org = await ctx.db.get(target.organizationId);
      if (org && org.adminUserId === target._id)
        throw new Error(
          "No puedes eliminar al administrador dueño de una organización"
        );
    }

    // Borrar permisos asociados (si existen)
    const perm = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", target._id))
      .unique();
    if (perm) await ctx.db.delete(perm._id);

    const result = { clerkId: target.clerkId ?? null, email: target.email ?? null };
    await ctx.db.delete(target._id);
    return result;
  },
});
