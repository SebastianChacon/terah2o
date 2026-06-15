import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { sendInvitationEmail } from "@/lib/email/invitation";

/**
 * POST /api/owner/create-client
 * Body: { orgName: string, adminName: string, adminEmail: string }
 *
 * Panel Owner (super-admin global). Crea una nueva organización + su admin
 * dueño + suscripción trial, y envía el correo de invitación al admin.
 * El gate de super-admin lo hace la mutación createClientOrg de Convex.
 */
export async function POST(req: NextRequest) {
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
  const { orgName, adminName, adminEmail } = body as {
    orgName?: string;
    adminName?: string;
    adminEmail?: string;
  };
  if (!orgName || !adminName || !adminEmail) {
    return NextResponse.json(
      { error: "Se requieren orgName, adminName y adminEmail" },
      { status: 400 }
    );
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);

  let created: { adminId: string; orgId: string; email: string; orgName: string };
  try {
    created = await convex.mutation(api.superAdmin.createClientOrg, {
      orgName: orgName.trim(),
      adminName: adminName.trim(),
      adminEmail: adminEmail.trim(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg.includes("No autorizado")
      ? 403
      : msg.includes("Ya existe")
        ? 422
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const emailResult = await sendInvitationEmail({
    to: created.email,
    name: adminName.trim(),
    orgName: created.orgName,
    role: "admin",
  });

  return NextResponse.json(
    {
      success: true,
      adminId: created.adminId,
      orgId: created.orgId,
      emailSent: emailResult.sent,
      emailSkipReason: emailResult.reason,
    },
    { status: 201 }
  );
}
