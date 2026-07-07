// convex/plans.ts
// Lectura pública (autenticada) de los planes comerciales por caudal.
// La escritura (crear/editar planes) vive en superAdmin.ts, detrás del gate
// de super-admin — este archivo solo expone lecturas que necesitan tanto el
// panel Owner como el dashboard/admin del cliente.

import { v } from "convex/values";
import { query } from "./_generated/server";

export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();
    return plans.sort((a, b) => a.order - b.order);
  },
});

export const getPricingConfig = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("pricingConfig").first();
  },
});

// Sugiere el plan de tipo "operaciones" cuyo rango [caudalMin, caudalMax)
// contiene el caudal dado. Solo una ayuda visual — el Owner puede anular.
export const suggestPlanForCaudal = query({
  args: { caudalLs: v.number() },
  handler: async (ctx, args) => {
    const plans = await ctx.db
      .query("plans")
      .filter((q) => q.eq(q.field("type"), "operaciones"))
      .collect();

    const match = plans.find(
      (p) =>
        p.caudalMin !== undefined &&
        p.caudalMax !== undefined &&
        args.caudalLs >= p.caudalMin &&
        args.caudalLs < p.caudalMax
    );
    return match ?? null;
  },
});
