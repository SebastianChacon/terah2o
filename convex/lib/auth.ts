// convex/lib/auth.ts
// Helper que reemplaza getAuthUserId de @convex-dev/auth.
// El identity.subject del JWT de Clerk es el clerkId ("user_2abc...").

import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

type AnyCtx = QueryCtx | MutationCtx;

/**
 * Retorna el documento users completo del usuario autenticado, o null.
 */
export async function getAuthenticatedUser(ctx: AnyCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  // 1. Buscar por clerkId (ruta principal)
  const byClerk = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (byClerk) return byClerk;

  // 2. Fallback: buscar por email (operadores pre-creados por el admin)
  const email = identity.email;
  if (!email) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

/**
 * Como getAuthenticatedUser pero lanza si no está autenticado.
 */
export async function requireAuthUser(ctx: AnyCtx) {
  const user = await getAuthenticatedUser(ctx);
  if (!user) throw new Error("Unauthenticated");
  return user;
}

/**
 * Drop-in replacement de getAuthUserId: retorna el _id de Convex o null.
 */
export async function getAuthenticatedUserId(
  ctx: AnyCtx
): Promise<Id<"users"> | null> {
  const user = await getAuthenticatedUser(ctx);
  return user?._id ?? null;
}
