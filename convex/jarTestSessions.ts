import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    organizationName: v.string(),
    samplePoint: v.string(),
    date: v.string(),
    plantFlow: v.number(),
    opHours: v.number(),
    rawWaterParams: v.array(
      v.object({
        label: v.string(),
        value: v.number(),
      })
    ),
    chemicals: v.array(
      v.object({
        name: v.string(),
        func: v.string(),
        concentration: v.number(),
        pricePerKg: v.number(),
      })
    ),
    observations: v.optional(v.string()),
    aiDiagnosis: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    return await ctx.db.insert("jarTestSessions", {
      ...args,
      organizationId: user?.organizationId,
    });
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      return await ctx.db.query("jarTestSessions").order("desc").collect();
    }
    return await ctx.db
      .query("jarTestSessions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .order("desc")
      .collect();
  },
});

export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      return await ctx.db.query("jarTestSessions").order("desc").first();
    }
    return await ctx.db
      .query("jarTestSessions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .order("desc")
      .first();
  },
});
