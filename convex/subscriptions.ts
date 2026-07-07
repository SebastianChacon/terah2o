import { query } from "./_generated/server";
import { getAuthenticatedUserId } from "./lib/auth";

// ── Obtener suscripción de la organización del usuario actual ──────────────
export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user?.organizationId) return null;

    return await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", user.organizationId!)
      )
      .order("desc")
      .first();
  },
});

// NOTA: createTrialSubscription / activateSubscription / updateSubscriptionStatus
// se eliminaron: no tenían ningún caller en el frontend (la activación real es
// manual, vía panel Owner → superAdmin.setSubscriptionGlobal) y no verificaban
// que el usuario autenticado perteneciera a `organizationId`, lo que permitía
// a cualquier cuenta activar o cancelar la suscripción de cualquier organización.
