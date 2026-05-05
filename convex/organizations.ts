import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── Crear organización (llamado tras el primer registro del Admin) ─────────
export const createOrganization = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Usuario no encontrado");
    if (user.role !== "admin") throw new Error("Solo un Admin puede crear organizaciones");

    // Verificar que no tenga ya una organización
    if (user.organizationId) {
      return user.organizationId;
    }

    // Crear organización
    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      adminUserId: user._id,
      maxOperators: 3,
      createdAt: Date.now(),
    });

    // Vincular el admin a la organización
    await ctx.db.patch(user._id, { organizationId: orgId });

    // Crear suscripción de prueba automáticamente
    await ctx.db.insert("subscriptions", {
      organizationId: orgId,
      status: "trialing",
      plan: "starter",
      trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 días
      createdAt: Date.now(),
    });

    return orgId;
  },
});

// ── Obtener la organización del usuario autenticado ────────────────────────
export const getMyOrganization = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user?.organizationId) return null;

    return await ctx.db.get(user.organizationId);
  },
});

// ── Actualizar nombre de la organización ──────────────────────────────────
export const updateOrganizationName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Solo un Admin puede actualizar la organización");
    if (!user.organizationId) throw new Error("Sin organización");

    await ctx.db.patch(user.organizationId, { name: args.name });
  },
});
