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
 * Limpieza best-effort de una cuenta Clerk. NUNCA lanza: el borrado en Convex
 * ya es la fuente de verdad. Devuelve true si se borró o no existía; false si
 * falló y quedó una cuenta Clerk huérfana.
 */
async function cleanupClerkAccount(
  clerkId: string | null,
  email: string | null
): Promise<boolean> {
  try {
    const clerkUserId = await resolveClerkUserId(clerkId, email);
    if (!clerkUserId) return true;
    const clerk = await clerkClient();
    await clerk.users.deleteUser(clerkUserId);
    return true;
  } catch {
    return false;
  }
}

/**
 * DELETE /api/owner/delete-org
 * Body: { organizationId: string }
 *
 * Panel Owner (super-admin global). Elimina una organización completa en
 * Convex (cascada) y borra las cuentas Clerk de todos sus miembros. El gate
 * de super-admin lo hace la mutación deleteOrganizationGlobal de Convex.
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
  const { organizationId } = body as { organizationId?: string };
  if (!organizationId) {
    return NextResponse.json(
      { error: "Se requiere organizationId" },
      { status: 400 }
    );
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);

  let result: { clerkIds: { clerkId: string | null; email: string | null }[] };
  try {
    result = await convex.mutation(api.superAdmin.deleteOrganizationGlobal, {
      organizationId: organizationId as Id<"organizations">,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg.includes("No autorizado") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  // Borrar las cuentas Clerk de los miembros (las que ya iniciaron sesión).
  // Best-effort: la cascada en Convex ya tuvo éxito; un fallo de Clerk no debe
  // devolver error. Se cuentan los residuos para reportarlos como warning.
  let clerkFailures = 0;
  for (const member of result.clerkIds) {
    const cleaned = await cleanupClerkAccount(member.clerkId, member.email);
    if (!cleaned) clerkFailures++;
  }

  return NextResponse.json({
    success: true,
    clerkFailures,
    ...(clerkFailures === 0
      ? {}
      : {
          warning: `La organización se eliminó, pero ${clerkFailures} cuenta(s) de inicio de sesión (Clerk) no se pudieron borrar. Bórralas manualmente si es necesario.`,
        }),
  });
}
