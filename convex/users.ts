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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // El subject del JWT de Clerk es el userId ("user_2abc...")
    const clerkId = identity.subject;
    const email = identity.email ?? "";

    // 1. Buscar por clerkId (ruta principal)
    const byClerk = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();

    if (byClerk) {
      // Ya registrado — actualizar nombre si cambió
      if (args.name && args.name !== byClerk.name) {
        await ctx.db.patch(byClerk._id, { name: args.name });
      }
      return byClerk._id;
    }

    // 2. ¿Hay un operador pre-creado con este email?
    const preCreated = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("role"), "operator"))
      .first();

    if (preCreated) {
      // Vincular el clerkId al operador pre-creado
      await ctx.db.patch(preCreated._id, {
        clerkId,
        tokenIdentifier: clerkId,
        ...(args.name ? { name: args.name } : {}),
      });
      return preCreated._id;
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

    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existingByEmail)
      throw new Error("Ya existe un usuario con ese correo electrónico");

    // clerkId se llenará cuando el operador haga su primer login
    const operatorId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
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
