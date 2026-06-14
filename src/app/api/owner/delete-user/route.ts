import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

async function resolveClerkUserId(
  clerkId: string | null | undefined,
  email: string | null | undefined
): Promise<string | null> {
  if (clerkId) return clerkId;
  if (!email) return null;

  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  return data[0]?.id ?? null;
}

/**
 * DELETE /api/owner/delete-user
 * Body: { userId: string }
 *
 * Panel Owner (super-admin global). Elimina cualquier cuenta en Convex y su
 * cuenta Clerk asociada. El gate de super-admin lo hace la mutación de Convex
 * (deleteUserGlobal lanza "No autorizado" si el llamador no es el owner).
 */
export async function DELETE(req: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CONVEX_URL is not configured" },
      { status: 503 }
    );
  }

  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { userId } = body as { userId?: string };
  if (!userId) {
    return NextResponse.json({ error: "Se requiere userId" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);

  let deleted: { clerkId: string | null; email: string | null };
  try {
    deleted = await convex.mutation(api.superAdmin.deleteUserGlobal, {
      userId: userId as Id<"users">,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg.includes("No autorizado") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  // Borrar también la cuenta Clerk (si la cuenta ya inició sesión alguna vez)
  const clerkUserId = await resolveClerkUserId(deleted.clerkId, deleted.email);
  if (clerkUserId) {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(clerkUserId).catch(() => null);
  }

  return NextResponse.json({ success: true });
}
