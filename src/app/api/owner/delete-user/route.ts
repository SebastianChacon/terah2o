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
 * Limpieza best-effort de la cuenta Clerk asociada. NUNCA lanza: el borrado en
 * Convex ya es la fuente de verdad, así que un fallo de Clerk (rate-limit, red,
 * key inválida, usuario inexistente) no debe convertir un borrado exitoso en
 * error. Devuelve true si la cuenta Clerk se borró o no existía; false si la
 * limpieza falló y quedó una cuenta Clerk huérfana.
 */
async function cleanupClerkAccount(
  clerkId: string | null,
  email: string | null
): Promise<boolean> {
  try {
    const clerkUserId = await resolveClerkUserId(clerkId, email);
    if (!clerkUserId) return true; // nunca inició sesión → nada que borrar
    const clerk = await clerkClient();
    await clerk.users.deleteUser(clerkUserId);
    return true;
  } catch {
    return false;
  }
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

  // Borrar también la cuenta Clerk (si la cuenta ya inició sesión alguna vez).
  // Best-effort: el borrado en Convex ya tuvo éxito, así que un fallo de Clerk
  // no debe devolver error. Se reporta como warning para no esconder el residuo.
  const clerkCleaned = await cleanupClerkAccount(deleted.clerkId, deleted.email);

  return NextResponse.json({
    success: true,
    clerkCleaned,
    ...(clerkCleaned
      ? {}
      : {
          warning:
            "La cuenta se eliminó de la base de datos, pero no se pudo borrar la cuenta de inicio de sesión (Clerk). Bórrala manualmente si es necesario.",
        }),
  });
}
