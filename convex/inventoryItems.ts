import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("inventoryItems").collect();
    },
});

export const getByItemId = query({
    args: { itemId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("inventoryItems")
            .withIndex("by_itemId", (q) => q.eq("itemId", args.itemId))
            .first();
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
        return await ctx.db.insert("inventoryItems", args);
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
