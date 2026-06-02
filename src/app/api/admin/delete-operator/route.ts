import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

async function resolveClerkUserId(
  clerkId: string | undefined,
  email: string | undefined
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
 * DELETE /api/admin/delete-operator
 * Body: { operatorId: string, clerkId?: string, email?: string }
 *
 * Elimina el operador en Convex (permisos incluidos) y su cuenta Clerk si existe.
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
  const { operatorId, clerkId, email } = body as {
    operatorId?: string;
    clerkId?: string;
    email?: string;
  };

  if (!operatorId) {
    return NextResponse.json({ error: "Se requiere operatorId" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);

  try {
    await convex.mutation(api.users.deleteOperator, {
      operatorId: operatorId as Id<"users">,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg.includes("Solo un Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const clerkUserId = await resolveClerkUserId(clerkId, email);
  if (clerkUserId) {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(clerkUserId).catch(() => null);
  }

  return NextResponse.json({ success: true });
}
