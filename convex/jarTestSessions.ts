import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
        return await ctx.db.insert("jarTestSessions", args);
    },
});

export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("jarTestSessions").order("desc").collect();
    },
});

export const getLatest = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("jarTestSessions").order("desc").first();
    },
});
