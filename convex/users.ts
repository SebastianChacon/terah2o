import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getAuthenticatedUser,
  getAuthenticatedUserId,
  requireAuthUser,
} from "./lib/auth";

// ── Obtener el usuario autenticado actual ──────────────────────────────────
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthenticatedUser(ctx);
  },
});

// ── Upsert: crear o actualizar perfil tras el primer login con Clerk ────────
// identity.subject del JWT de Clerk ES el clerkId — no se pasa desde el cliente.
export const upsertCurrentUser = mutation({
  args: {
    name: v.optional(v.string()),
    // Client passes email because Clerk JWT template may not include it
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const clerkId = identity.subject;
    // identity.email is null when Clerk JWT template doesn't include the email claim.
    // args.email (from client useUser()) is the reliable fallback.
    const email = (identity.email ?? args.email ?? "").trim().toLowerCase();

    // 1. Buscar por clerkId (ruta principal)
    const byClerk = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();

    if (byClerk) {
      if (byClerk.organizationId) {
        // Registro completo — actualizar campos si cambiaron
        const patches: Record<string, string> = {};
        if (args.name && args.name !== byClerk.name) patches.name = args.name;
        if (email && !byClerk.email) patches.email = email;
        if (Object.keys(patches).length > 0) await ctx.db.patch(byClerk._id, patches);
        return byClerk._id;
      }

      // Doc sin org — fusionar con doc más antiguo si se puede encontrar por email
      const lookupEmail = email || byClerk.email || "";
      if (lookupEmail) {
        const olderDoc = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", lookupEmail))
          .filter((q) => q.neq(q.field("_id"), byClerk._id))
          .first();
        if (olderDoc) {
          await ctx.db.patch(olderDoc._id, { clerkId, tokenIdentifier: clerkId });
          await ctx.db.delete(byClerk._id);
          return olderDoc._id;
        }
      }

      // Sin doc antiguo — guardar email y nombre en el registro actual
      const patches: Record<string, string> = {};
      if (email && !byClerk.email) patches.email = email;
      if (args.name && args.name !== byClerk.name) patches.name = args.name;
      if (Object.keys(patches).length > 0) await ctx.db.patch(byClerk._id, patches);
      return byClerk._id;
    }

    // 2. ¿Existe ya un usuario con este email (cualquier rol)?
    // Cubre admins pre-existentes de la migración de auth y operadores pre-creados.
    if (email) {
      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (existingByEmail) {
        await ctx.db.patch(existingByEmail._id, {
          clerkId,
          tokenIdentifier: clerkId,
          ...(args.name ? { name: args.name } : {}),
        });
        return existingByEmail._id;
      }
    }

    // 3. Primera vez — crear como admin
    const userId = await ctx.db.insert("users", {
      clerkId,
      tokenIdentifier: clerkId,
      email,
      name: args.name,
      role: "admin",
      createdAt: Date.now(),
    });

    return userId;
  },
});

// ── Crear operador (llamado por el Admin desde dashboard) ──────────────────
export const createOperator = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const caller = await requireAuthUser(ctx);
    if (caller.role !== "admin") throw new Error("Solo un Admin puede crear operadores");
    if (caller.organizationId !== args.organizationId)
      throw new Error("No perteneces a esta organización");

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
        `Límite de operadores alcanzado (${org.maxOperators}). Actualiza tu plan.`
      );
    }

    const email = args.email.trim().toLowerCase();
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingByEmail)
      throw new Error("Ya existe un usuario con ese correo electrónico");

    // clerkId se llenará cuando el operador haga su primer login
    const operatorId = await ctx.db.insert("users", {
      email,
      name: args.name.trim(),
      role: "operator",
      organizationId: args.organizationId,
      createdAt: Date.now(),
    });

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

// ── Eliminar operador (admin-only, misma org) ─────────────────────────────
export const deleteOperator = mutation({
  args: { operatorId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await requireAuthUser(ctx);
    if (caller.role !== "admin")
      throw new Error("Solo un Admin puede eliminar operadores");

    const operator = await ctx.db.get(args.operatorId);
    if (!operator || operator.organizationId !== caller.organizationId)
      throw new Error("El operador no pertenece a tu organización");

    if (operator.role !== "operator")
      throw new Error("No se puede eliminar un administrador");

    const perms = await ctx.db
      .query("operatorPermissions")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .unique();
    if (perms) await ctx.db.delete(perms._id);

    await ctx.db.delete(args.operatorId);
  },
});

const DEFAULT_MAX_ADMINS = 2;

// ── Invitar co-admin (pre-registro; se vincula en primer login con Clerk) ───
export const inviteAdmin = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const caller = await requireAuthUser(ctx);
    if (caller.role !== "admin")
      throw new Error("Solo un Admin puede invitar administradores");
    if (caller.organizationId !== args.organizationId)
      throw new Error("No perteneces a esta organización");

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");
    const maxAdmins = org.maxAdmins ?? DEFAULT_MAX_ADMINS;

    const admins = await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();

    if (admins.length >= maxAdmins) {
      throw new Error(`Límite de administradores alcanzado (${maxAdmins}).`);
    }

    const email = args.email.trim().toLowerCase();
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existingByEmail)
      throw new Error("Ya existe un usuario con ese correo electrónico");

    return await ctx.db.insert("users", {
      email,
      name: args.name.trim(),
      role: "admin",
      organizationId: args.organizationId,
      createdAt: Date.now(),
    });
  },
});

// ── Listar administradores de la organización ─────────────────────────────
export const getAdminsByOrg = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthenticatedUser(ctx);
    if (!caller?.organizationId || caller.role !== "admin") return [];

    return await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", caller.organizationId)
      )
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
  },
});

// ── Listar operadores de la organización ───────────────────────────────────
export const getOperatorsByOrg = query({
  args: {},
  handler: async (ctx) => {
    const caller = await getAuthenticatedUser(ctx);
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
