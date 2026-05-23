import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUserId } from "./lib/auth";

// ── Obtener suscripción de la organización del usuario actual ──────────────
export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user?.organizationId) return null;

    return await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId!)
      )
      .order("desc")
      .first();
  },
});

// ── Crear suscripción de prueba (trial) ───────────────────────────────────
export const createTrialSubscription = mutation({
  args: {
    organizationId: v.id("organizations"),
    plan: v.union(v.literal("starter"), v.literal("pro")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    // Verificar que no existe ya una suscripción activa
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    if (existing) {
      // Si ya existe, simplemente actualizar a trialing si estaba cancelada
      if (existing.status === "canceled") {
        await ctx.db.patch(existing._id, {
          status: "trialing",
          plan: args.plan,
          trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
        });
        return existing._id;
      }
      return existing._id;
    }

    return await ctx.db.insert("subscriptions", {
      organizationId: args.organizationId,
      status: "trialing",
      plan: args.plan,
      trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 días
      createdAt: Date.now(),
    });
  },
});

// ── Activar suscripción (tras pago exitoso) ───────────────────────────────
export const activateSubscription = mutation({
  args: {
    organizationId: v.id("organizations"),
    plan: v.union(v.literal("starter"), v.literal("pro")),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    if (sub) {
      await ctx.db.patch(sub._id, {
        status: "active",
        plan: args.plan,
        expiresAt: args.expiresAt,
      });
      return sub._id;
    }

    return await ctx.db.insert("subscriptions", {
      organizationId: args.organizationId,
      status: "active",
      plan: args.plan,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

// ── Actualizar estado de suscripción (webhooks de pasarela futura) ─────────
export const updateSubscriptionStatus = mutation({
  args: {
    organizationId: v.id("organizations"),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled")
    ),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();
    if (!sub) throw new Error("Suscripción no encontrada");
    await ctx.db.patch(sub._id, { status: args.status });
  },
});
