import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUserId } from "./lib/auth";

// ── Crear organización (llamado tras el primer registro del Admin) ─────────
export const createOrganization = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
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

    // NO se crea suscripción aquí: un usuario recién registrado queda SIN plan.
    // La activación es manual: el cliente contacta por WhatsApp desde /pricing
    // y el Owner activa la suscripción desde el panel (superAdmin.setSubscriptionGlobal).
    // El gate de suscripción (proxy + SubscriptionGate) redirige a /pricing
    // mientras no tenga una suscripción activa/trial.
    return orgId;
  },
});

// ── Obtener la organización del usuario autenticado ────────────────────────
export const getMyOrganization = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
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
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Solo un Admin puede actualizar la organización");
    if (!user.organizationId) throw new Error("Sin organización");

    await ctx.db.patch(user.organizationId, { name: args.name });
  },
});
