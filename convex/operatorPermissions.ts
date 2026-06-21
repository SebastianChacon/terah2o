import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthenticatedUserId } from "./lib/auth";
import { clampPerms, normalizePerms, readPerms } from "./lib/permissions";

const EMPTY_PERMS = readPerms(null);

/**
 * Entitlements efectivos de una organización (8 flags, normalizados).
 * Fuente de verdad de "qué páginas tiene la org". Ausente ⇒ todo false.
 */
async function getOrgEntitlements(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations"> | undefined | null
) {
  if (!organizationId) return EMPTY_PERMS;
  const org = await ctx.db.get(organizationId);
  return normalizePerms(readPerms(org));
}

// ── Obtener permisos del operador actual ──────────────────────────────────
export const getMyPermissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    // Entitlements de la org: techo para admin y operador.
    const orgEnt = await getOrgEntitlements(ctx, user.organizationId);

    // Los admins ven exactamente lo que la org tiene habilitado.
    if (user.role === "admin") {
      return orgEnt;
    }

    // Para operadores: efectivo = entitlements de la org AND permisos del operador.
    const perms = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", user._id))
      .unique();

    return clampPerms(readPerms(perms), orgEnt);
  },
});

// ── Obtener permisos de un operador específico (vista admin) ──────────────
export const getPermissionsByOperator = query({
  args: { operatorId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .unique();
  },
});

// ── Crear o actualizar permisos de un operador ────────────────────────────
export const upsertPermissions = mutation({
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
    const callerId = await getAuthenticatedUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");

    const caller = await ctx.db.get(callerId);
    if (!caller || caller.role !== "admin")
      throw new Error("Solo un Admin puede modificar permisos");

    // Verificar que el operador pertenece a la misma organización
    const operator = await ctx.db.get(args.operatorId);
    if (!operator || operator.organizationId !== caller.organizationId)
      throw new Error("El operador no pertenece a tu organización");

    const existing = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .unique();

    // Un admin no puede otorgar a un operador un permiso que su organización no
    // tiene: topamos lo solicitado contra los entitlements de la org.
    const orgEnt = await getOrgEntitlements(ctx, caller.organizationId);
    const clamped = clampPerms(readPerms(args), orgEnt);

    const permsData = {
      operatorId: args.operatorId,
      organizationId: caller.organizationId!,
      ...clamped,
    };

    if (existing) {
      await ctx.db.patch(existing._id, permsData);
      return existing._id;
    }
    return await ctx.db.insert("operatorPermissions", permsData);
  },
});

// ── Listar todos los permisos de operadores de la org ─────────────────────
export const getPermissionsByOrg = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user?.organizationId) return [];

    const orgId = user.organizationId;
    const byOrgIndex = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
      .collect();

    const seen = new Set(byOrgIndex.map((p) => p._id));

    // Incluir registros legacy sin organizationId indexado
    const operators = await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
      .filter((q) => q.eq(q.field("role"), "operator"))
      .collect();

    for (const op of operators) {
      const perm = await ctx.db
        .query("operatorPermissions")
        .withIndex("by_operatorId", (q) => q.eq("operatorId", op._id))
        .unique();
      if (perm && !seen.has(perm._id)) {
        byOrgIndex.push(perm);
        seen.add(perm._id);
      }
    }

    return byOrgIndex;
  },
});

// ── Backfill organizationId en permisos legacy (admin-only, idempotente) ───
export const backfillOrganizationIds = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const caller = await ctx.db.get(userId);
    if (!caller || caller.role !== "admin")
      throw new Error("Solo un Admin puede ejecutar el backfill");

    const allPerms = await ctx.db.query("operatorPermissions").collect();
    let patched = 0;

    for (const perm of allPerms) {
      const operator = await ctx.db.get(perm.operatorId);
      if (!operator?.organizationId) continue;
      if (perm.organizationId === operator.organizationId) continue;

      await ctx.db.patch(perm._id, {
        organizationId: operator.organizationId,
      });
      patched += 1;
    }

    return { patched };
  },
});
