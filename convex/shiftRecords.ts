import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const hourlyReadingValidator = v.object({
  hora: v.string(),
  caudal: v.optional(v.number()),
  ph: v.optional(v.number()),
  cloro: v.optional(v.number()),
  color: v.optional(v.number()),
  turbiedad: v.optional(v.number()),
  rawPh: v.optional(v.number()),
  rawCloro: v.optional(v.number()),
  rawColor: v.optional(v.number()),
  rawTurbiedad: v.optional(v.number()),
  status: v.optional(v.string()),
});

const dosificationEntryValidator = v.object({
  product: v.string(),
  mlMin: v.number(),
  concentration: v.number(),
  doseResult: v.number(),
  autonomyDays: v.optional(v.number()),
});

const statsValidator = v.object({
  avgFlow: v.number(),
  volumeTurno: v.number(),
  projection24h: v.number(),
  compliancePercent: v.number(),
});

export const create = mutation({
  args: {
    operatorName: v.string(),
    date: v.string(),
    operationHours: v.number(),
    plantFlowRef: v.optional(v.number()),
    hourlyReadings: v.array(hourlyReadingValidator),
    dosificationEntries: v.array(dosificationEntryValidator),
    stats: statsValidator,
    notes: v.optional(v.string()),
    aiConsultation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    return await ctx.db.insert("shiftRecords", {
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
      return await ctx.db.query("shiftRecords").order("desc").collect();
    }
    return await ctx.db
      .query("shiftRecords")
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
      .query("shiftRecords")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    if (!user?.organizationId) return all;
    return all.filter((r) => r.organizationId === user.organizationId);
  },
});

export const getByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    const all = await ctx.db
      .query("shiftRecords")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate)
      )
      .collect();
    if (!user?.organizationId) return all;
    return all.filter((r) => r.organizationId === user.organizationId);
  },
});

export const update = mutation({
  args: {
    id: v.id("shiftRecords"),
    operatorName: v.optional(v.string()),
    date: v.optional(v.string()),
    operationHours: v.optional(v.number()),
    plantFlowRef: v.optional(v.number()),
    hourlyReadings: v.optional(v.array(hourlyReadingValidator)),
    dosificationEntries: v.optional(v.array(dosificationEntryValidator)),
    stats: v.optional(statsValidator),
    notes: v.optional(v.string()),
    aiConsultation: v.optional(v.string()),
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
