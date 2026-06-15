import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Seeds org + subscription for a test user identified by email.
 * Idempotent — safe to call multiple times.
 * Called only from the HTTP test-setup action (dev only).
 */
export const setupTestUser = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!user) return { error: `User not found: ${email}` };

    // El usuario de prueba debe ser admin (gate del panel + dueño de su org).
    if ((user.role ?? "operator") !== "admin") {
      await ctx.db.patch(user._id, { role: "admin" });
    }

    let orgId = user.organizationId;
    if (!orgId) {
      orgId = await ctx.db.insert("organizations", {
        name: "Organización Principal",
        adminUserId: user._id,
        maxOperators: 3,
        createdAt: Date.now(),
      });
      await ctx.db.patch(user._id, { organizationId: orgId });
    } else {
      // Auto-sanar drift de propiedad: el owner de prueba debe ser el dueño
      // (adminUserId) de su org. Tests previos de transferencia pueden haberla
      // dejado apuntando a una cuenta de prueba huérfana.
      const org = await ctx.db.get(orgId);
      if (org && org.adminUserId !== user._id) {
        await ctx.db.patch(orgId, { adminUserId: user._id });
      }
    }

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", orgId!))
      .first();

    if (!existing) {
      const trialEndsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await ctx.db.insert("subscriptions", {
        organizationId: orgId!,
        status: "trialing",
        plan: "pro",
        trialEndsAt,
        createdAt: Date.now(),
      });
    }

    return { orgId, success: true };
  },
});

/**
 * Seeds a disposable operator (Convex-only, no Clerk account) inside the org
 * owned by `ownerEmail`. Used by the E2E delete-account test: this operator is
 * NOT an org owner, so the super-admin can delete it cleanly (no Clerk side
 * effects because it never logged in). Returns its id + email.
 * Called only from the dev-only HTTP test-setup action.
 */
export const seedDisposableOperator = internalMutation({
  args: { ownerEmail: v.string() },
  handler: async (ctx, { ownerEmail }) => {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", ownerEmail))
      .first();
    if (!owner) return { error: `Owner not found: ${ownerEmail}` };
    if (!owner.organizationId)
      return { error: `Owner has no organization: ${ownerEmail}` };

    // Barrer operadores desechables huérfanos de corridas previas fallidas.
    const stale = await ctx.db
      .query("users")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", owner.organizationId!)
      )
      .collect();
    for (const u of stale) {
      if (!(u.email ?? "").startsWith("e2e.disposable.")) continue;
      const perm = await ctx.db
        .query("operatorPermissions")
        .withIndex("by_operatorId", (q) => q.eq("operatorId", u._id))
        .unique();
      if (perm) await ctx.db.delete(perm._id);
      await ctx.db.delete(u._id);
    }

    const email = `e2e.disposable.${Date.now()}@ptap.ec`;
    const operatorId = await ctx.db.insert("users", {
      email,
      name: `E2E Disposable ${Date.now()}`,
      role: "operator",
      organizationId: owner.organizationId,
      createdAt: Date.now(),
    });

    await ctx.db.insert("operatorPermissions", {
      operatorId,
      organizationId: owner.organizationId,
      canAccessOperaciones: false,
      canAccessAsistencia: false,
      canAccessAcademia: false,
      canAccessBitacora: false,
    });

    return { operatorId, email, success: true };
  },
});
