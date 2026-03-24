import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Obtener el usuario autenticado actual ──────────────────────────────────
// getAuthUserId devuelve el _id del documento en la tabla users.
// Usamos ctx.db.get() directamente en lugar del índice by_tokenIdentifier.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

// ── Registrar/sincronizar usuario en la tabla users tras el primer login ───
// @convex-dev/auth inserta {email:"..."} — upsertCurrentUser completa los
// campos de negocio (role, tokenIdentifier, createdAt) haciendo un patch.
export const upsertCurrentUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(userId);
    if (!existing) throw new Error("Usuario no encontrado en auth");

    if (existing.role) {
      // Ya tiene perfil de negocio — solo actualizar nombre si cambió
      if (args.name && args.name !== existing.name) {
        await ctx.db.patch(userId, { name: args.name });
      }
      return userId;
    }

    // Primera vez: inicializar perfil de negocio
    // tokenIdentifier = userId para que los índices by_tokenIdentifier funcionen
    await ctx.db.patch(userId, {
      tokenIdentifier: userId,
      role: "admin",
      createdAt: Date.now(),
      ...(args.name ? { name: args.name } : {}),
    });
    return userId;
  },
});

// ── Crear un operador (llamado por el Admin) ───────────────────────────────
export const createOperator = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Unauthenticated");

    // Verificar que quien llama es admin de esa organización
    const caller = await ctx.db.get(callerId);
    if (!caller || caller.role !== "admin") throw new Error("Solo un Admin puede crear operadores");
    if (caller.organizationId !== args.organizationId)
      throw new Error("No perteneces a esta organización");

    // Contar operadores actuales
    const operators = await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .filter((q) => q.eq(q.field("role"), "operator"))
      .collect();

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");
    if (operators.length >= org.maxOperators) {
      throw new Error(
        `Límite de operadores alcanzado (${org.maxOperators}). Actualiza tu plan para agregar más.`
      );
    }

    // Crear el perfil del operador (tokenIdentifier pending hasta primer login)
    const pendingToken = `pending_${args.email}`;
    const operatorId = await ctx.db.insert("users", {
      tokenIdentifier: pendingToken,
      email: args.email,
      name: args.name,
      role: "operator",
      organizationId: args.organizationId,
      createdAt: Date.now(),
    });

    // Crear permisos por defecto (todos en false, el admin los activa)
    await ctx.db.insert("operatorPermissions", {
      operatorId,
      organizationId: args.organizationId,
      canAccessOperaciones: false,
      canAccessAsistencia: false,
      canAccessAcademia: false,
      canAccessBitacora: false,
    });

    return operatorId;
  },
});

// ── Listar operadores de la organización del admin ─────────────────────────
export const getOperatorsByOrg = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const caller = await ctx.db.get(userId);
    if (!caller?.organizationId) return [];

    return await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", caller.organizationId)
      )
      .filter((q) => q.eq(q.field("role"), "operator"))
      .collect();
  },
});
