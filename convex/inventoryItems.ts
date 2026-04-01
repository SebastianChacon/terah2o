import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      return await ctx.db.query("inventoryItems").collect();
    }
    return await ctx.db
      .query("inventoryItems")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();
  },
});

export const getByItemId = query({
  args: { itemId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const item = await ctx.db
      .query("inventoryItems")
      .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
      .first();
    if (!item) return null;
    if (user?.organizationId && item.organizationId !== user.organizationId) return null;
    return item;
  },
});

export const create = mutation({
  args: {
    itemId: v.string(),
    itemName: v.string(),
    amount: v.number(),
    unit: v.string(),
    minimumLevel: v.number(),
    dailyConsumption: v.number(),
    isCorrelated: v.boolean(),
    lastUpdated: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    return await ctx.db.insert("inventoryItems", {
      ...args,
      organizationId: user?.organizationId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("inventoryItems"),
    itemId: v.optional(v.string()),
    itemName: v.optional(v.string()),
    amount: v.optional(v.number()),
    unit: v.optional(v.string()),
    minimumLevel: v.optional(v.number()),
    dailyConsumption: v.optional(v.number()),
    isCorrelated: v.optional(v.boolean()),
    lastUpdated: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(id, updates);
  },
});

export const updateAmount = mutation({
  args: {
    id: v.id("inventoryItems"),
    amount: v.number(),
    lastUpdated: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      amount: args.amount,
      lastUpdated: args.lastUpdated,
    });
  },
});
