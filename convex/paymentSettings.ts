// convex/paymentSettings.ts
// Pagos (Payphone). Las credenciales (Store ID, token) NUNCA se guardan en
// Convex ni pasan por el navegador — solo viven como env vars server-side
// (PAYPHONE_STORE_ID, PAYPHONE_TOKEN, configuradas con `npx convex env set`).
// Esta tabla/queries solo controlan un toggle de habilitación y exponen si
// las env vars están presentes, sin revelar su valor. El cobro real (crear
// el link de pago / webhook) queda fuera de este trabajo.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireSuperAdmin } from "./superAdmin";

export const getPaymentSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const settings = await ctx.db.query("platformSettings").first();
    return {
      payphoneEnabled: settings?.payphoneEnabled ?? false,
      hasCredentials: Boolean(
        process.env.PAYPHONE_STORE_ID && process.env.PAYPHONE_TOKEN
      ),
    };
  },
});

export const setPayphoneEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);

    if (args.enabled && !(process.env.PAYPHONE_STORE_ID && process.env.PAYPHONE_TOKEN)) {
      throw new Error(
        "Configura PAYPHONE_STORE_ID y PAYPHONE_TOKEN en Convex antes de habilitar Payphone"
      );
    }

    const existing = await ctx.db.query("platformSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, { payphoneEnabled: args.enabled });
      return existing._id;
    }
    return await ctx.db.insert("platformSettings", { payphoneEnabled: args.enabled });
  },
});
