import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { sendInvitationEmail } from "@/lib/email/invitation";

/**
 * POST /api/admin/create-operator
 * Body: { email: string, name: string, organizationId: string }
 *
 * Usa el token de Clerk (template "convex") para autenticarse contra Convex.
 * La autorizacion real se valida en la mutacion createOperator de Convex.
 */
export async function POST(req: NextRequest) {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_CONVEX_URL is not configured" },
        { status: 503 }
      );
    }

    // Obtener token de Clerk para el template "convex"
    const { getToken } = await auth();
    const token = await getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);

    const body = await req.json();
    const { email, name, organizationId, orgName } = body as {
      email?: string;
      name?: string;
      organizationId?: string;
      orgName?: string;
    };

    if (!email || !name || !organizationId) {
      return NextResponse.json(
        { error: "Se requieren email, name y organizationId" },
        { status: 400 }
      );
    }

    const operatorId = await convex.mutation(api.users.createOperator, {
      email: email.trim(),
      name: name.trim(),
      organizationId: organizationId as Id<"organizations">,
    });

    const emailResult = await sendInvitationEmail({
      to: email.trim(),
      name: name.trim(),
      orgName: orgName ?? "tu organizacion",
      role: "operator",
    });

    return NextResponse.json(
      {
        success: true,
        operatorId,
        emailSent: emailResult.sent,
        emailSkipReason: emailResult.reason,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg.includes("Limite") ? 422 : msg.includes("Solo un Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
