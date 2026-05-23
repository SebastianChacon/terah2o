import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUserId } from "./lib/auth";

const hrCostValidator = v.object({
  role: v.string(),
  quantity: v.number(),
  salary: v.number(),
  subtotal: v.number(),
});

const expensesValidator = v.object({
  energy: v.number(),
  internet: v.number(),
  pettyCash: v.number(),
  maintenance: v.number(),
});

const chemicalValidator = v.object({
  name: v.string(),
  dose: v.optional(v.number()),
  totalKg: v.optional(v.number()),
  pricePerKg: v.number(),
  monthlyCost: v.number(),
});

const productionValidator = v.object({
  plantFlow: v.optional(v.number()),
  opHours: v.optional(v.number()),
  realM3: v.optional(v.number()),
  volumeMonth: v.number(),
});

const sustainabilityValidator = v.object({
  lossPercent: v.number(),
  billableVolume: v.number(),
  userRate: v.number(),
  breakEvenRate: v.number(),
  revenue: v.number(),
  profit: v.number(),
});

const totalsValidator = v.object({
  totalChemicals: v.number(),
  totalLabor: v.number(),
  totalOther: v.number(),
  grandTotal: v.number(),
  costPerM3: v.number(),
});

export const create = mutation({
  args: {
    institutionName: v.string(),
    mode: v.union(v.literal("projection"), v.literal("analysis")),
    period: v.optional(v.string()),
    production: productionValidator,
    humanResources: v.array(hrCostValidator),
    operationalExpenses: expensesValidator,
    chemicals: v.array(chemicalValidator),
    sustainability: sustainabilityValidator,
    totals: totalsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    return await ctx.db.insert("financialProjections", {
      ...args,
      organizationId: user?.organizationId,
    });
  },
});

export const linkRealAnalysis = mutation({
  args: {
    institutionName: v.string(),
    period: v.string(),
    analysisGrandTotal: v.number(),
  },
  handler: async (ctx, { institutionName, period, analysisGrandTotal }) => {
    const userId = await getAuthenticatedUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;

    const all = user?.organizationId
      ? await ctx.db
          .query("financialProjections")
          .withIndex("by_organizationId", (q) =>
            q.eq("organizationId", user.organizationId)
          )
          .collect()
      : await ctx.db.query("financialProjections").collect();

    const projection = all.find(
      (p) =>
        p.mode === "projection" &&
        p.institutionName === institutionName &&
        p.period === period
    );

    if (!projection) return null;

    const análisisProyectado = projection.totals.grandTotal;
    const análisisReal = analysisGrandTotal;
    const cumplimiento =
      análisisProyectado > 0
        ? ((análisisReal - análisisProyectado) / análisisProyectado) * 100
        : 0;

    await ctx.db.patch(projection._id, {
      analisisProyectado: análisisProyectado,
      analisisReal: análisisReal,
      cumplimiento,
    });

    return projection._id;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      return await ctx.db.query("financialProjections").order("desc").collect();
    }
    return await ctx.db
      .query("financialProjections")
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
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user?.organizationId) {
      return await ctx.db.query("financialProjections").order("desc").first();
    }
    return await ctx.db
      .query("financialProjections")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .order("desc")
      .first();
  },
});

export const update = mutation({
  args: {
    id: v.id("financialProjections"),
    institutionName: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("projection"), v.literal("analysis"))),
    production: v.optional(productionValidator),
    humanResources: v.optional(v.array(hrCostValidator)),
    operationalExpenses: v.optional(expensesValidator),
    chemicals: v.optional(v.array(chemicalValidator)),
    sustainability: v.optional(sustainabilityValidator),
    totals: v.optional(totalsValidator),
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
