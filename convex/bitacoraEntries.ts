import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    date: v.string(),
    source: v.string(),
    category: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    return await ctx.db.insert("bitacoraEntries", {
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
      return await ctx.db.query("bitacoraEntries").order("desc").collect();
    }
    return await ctx.db
      .query("bitacoraEntries")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .order("desc")
      .collect();
  },
});

export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const all = await ctx.db
      .query("bitacoraEntries")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    if (!user?.organizationId) return all;
    return all.filter((e) => e.organizationId === user.organizationId);
  },
});

export const getByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const all = await ctx.db
      .query("bitacoraEntries")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
    if (!user?.organizationId) return all;
    return all.filter((e) => e.organizationId === user.organizationId);
  },
});

export const getByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const all = await ctx.db
      .query("bitacoraEntries")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate)
      )
      .collect();
    if (!user?.organizationId) return all;
    return all.filter((e) => e.organizationId === user.organizationId);
  },
});
