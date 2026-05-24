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

    let orgId = user.organizationId;
    if (!orgId) {
      orgId = await ctx.db.insert("organizations", {
        name: "Organización Principal",
        adminUserId: user._id,
        maxOperators: 3,
        createdAt: Date.now(),
      });
      await ctx.db.patch(user._id, { organizationId: orgId });
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
