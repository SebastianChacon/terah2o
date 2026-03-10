import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        date: v.string(),
        source: v.string(),
        category: v.string(),
        summary: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("bitacoraEntries", args);
    },
});

export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("bitacoraEntries").order("desc").collect();
    },
});

export const getByDate = query({
    args: { date: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("bitacoraEntries")
            .withIndex("by_date", (q) => q.eq("date", args.date))
            .collect();
    },
});

export const getByCategory = query({
    args: { category: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("bitacoraEntries")
            .withIndex("by_category", (q) => q.eq("category", args.category))
            .collect();
    },
});

export const getByDateRange = query({
    args: { startDate: v.string(), endDate: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("bitacoraEntries")
            .withIndex("by_date", (q) =>
                q.gte("date", args.startDate).lte("date", args.endDate)
            )
            .collect();
    },
});
