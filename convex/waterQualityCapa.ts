import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUserId } from "./lib/auth";

export const getByTest = query({
  args: { testId: v.id("waterQualityTests") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("waterQualityCapaActions")
      .withIndex("by_testId", (q) => q.eq("testId", args.testId))
      .collect();
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      return await ctx.db.query("waterQualityCapaActions").collect();
    }
    return await ctx.db
      .query("waterQualityCapaActions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();
  },
});

// Crea o actualiza la acción CAPA de un (testId, paramKey). Un no
// conformidad puede editarse repetidas veces (causa raíz, acción,
// responsable, estado) por distintos usuarios — upsert evita duplicados.
export const upsert = mutation({
  args: {
    testId: v.id("waterQualityTests"),
    paramKey: v.string(),
    categoria6M: v.optional(v.string()),
    porques: v.optional(v.string()),
    accion: v.optional(v.string()),
    responsable: v.optional(v.string()),
    estado: v.union(
      v.literal("Abierta"),
      v.literal("En proceso"),
      v.literal("Cerrada"),
      v.literal("Verificada")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;

    const existing = await ctx.db
      .query("waterQualityCapaActions")
      .withIndex("by_testId", (q) => q.eq("testId", args.testId))
      .filter((q) => q.eq(q.field("paramKey"), args.paramKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        categoria6M: args.categoria6M,
        porques: args.porques,
        accion: args.accion,
        responsable: args.responsable,
        estado: args.estado,
      });
      return existing._id;
    }

    return await ctx.db.insert("waterQualityCapaActions", {
      ...args,
      organizationId: user?.organizationId,
    });
  },
});
