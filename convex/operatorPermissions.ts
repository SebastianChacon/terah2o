import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUserId } from "./lib/auth";

// ── Obtener permisos del operador actual ──────────────────────────────────
export const getMyPermissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    // Los admins tienen todos los permisos siempre
    if (user.role === "admin") {
      return {
        canAccessOperaciones: true,
        canAccessAsistencia: true,
        canAccessAcademia: true,
        canAccessBitacora: true,
      };
    }

    // Para operadores: buscar en la tabla de permisos
    const perms = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", user._id))
      .unique();

    if (!perms) {
      return {
        canAccessOperaciones: false,
        canAccessAsistencia: false,
        canAccessAcademia: false,
        canAccessBitacora: false,
      };
    }

    return {
      canAccessOperaciones: perms.canAccessOperaciones,
      canAccessAsistencia: perms.canAccessAsistencia,
      canAccessAcademia: perms.canAccessAcademia,
      canAccessBitacora: perms.canAccessBitacora,
    };
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

    const permsData = {
      operatorId: args.operatorId,
      organizationId: caller.organizationId!,
      canAccessOperaciones: args.canAccessOperaciones,
      canAccessAsistencia: args.canAccessAsistencia,
      canAccessAcademia: args.canAccessAcademia,
      canAccessBitacora: args.canAccessBitacora,
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

    return await ctx.db
      .query("operatorPermissions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId!)
      )
      .collect();
  },
});
