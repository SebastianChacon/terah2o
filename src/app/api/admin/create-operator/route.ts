import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

/**
 * POST /api/admin/create-operator
 * Body: { email: string, name: string, organizationId: string }
 *
 * Requiere la cookie __convexAuthJWT (seteada por @convex-dev/auth).
 * Valida en Convex que el caller es Admin de esa organización.
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
    const convex = new ConvexHttpClient(convexUrl);
    const token = req.cookies.get("__convexAuthJWT")?.value;
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { email, name, organizationId } = body as {
      email?: string;
      name?: string;
      organizationId?: string;
    };

    if (!email || !name || !organizationId) {
      return NextResponse.json(
        { error: "Se requieren email, name y organizationId" },
        { status: 400 }
      );
    }

    // Llamar la mutación de Convex con el token del usuario
    convex.setAuth(token);
    const operatorId = await convex.mutation(api.users.createOperator, {
      email,
      name,
      organizationId: organizationId as Id<"organizations">,
    });

    return NextResponse.json({ success: true, operatorId }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg.includes("Límite") ? 422 : msg.includes("Solo un Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
