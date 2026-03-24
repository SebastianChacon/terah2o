import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return await ctx.db.query("plantSettings").first();
    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      return await ctx.db.query("plantSettings").first();
    }
    return await ctx.db
      .query("plantSettings")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .first();
  },
});

export const upsert = mutation({
  args: {
    location: v.string(),
    plantSize: v.string(),
    chemical: v.string(),
    avgDose: v.number(),
    avgConc: v.number(),
    lastFetch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;

    const orgId = user?.organizationId;

    const existing = orgId
      ? await ctx.db
          .query("plantSettings")
          .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId))
          .first()
      : await ctx.db.query("plantSettings").first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, organizationId: orgId });
      return existing._id;
    }
    return await ctx.db.insert("plantSettings", { ...args, organizationId: orgId });
  },
});
