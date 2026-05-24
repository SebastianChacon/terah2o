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

  // Happy path: encontrado por clerkId y tiene org → retornar directo
  if (byClerk?.organizationId) return byClerk;

  // 2. Fallback por email: maneja duplicados de migración y upserts incompletos.
  // identity.email puede ser null si el JWT template de Clerk no incluye el claim email.
  // byClerk.email es el valor guardado por upsertCurrentUser (con client email como fallback).
  const email = identity.email ?? byClerk?.email;
  if (email) {
    const byEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (byEmail && byEmail._id !== byClerk?._id) return byEmail;
  }

  return byClerk ?? null;
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
