import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("plantSettings").first();
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
        const existing = await ctx.db.query("plantSettings").first();
        if (existing) {
            await ctx.db.patch(existing._id, args);
            return existing._id;
        }
        return await ctx.db.insert("plantSettings", args);
    },
});
