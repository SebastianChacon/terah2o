import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

/**
 * PATCH /api/admin/update-permissions
 * Body: {
 *   operatorId: string,
 *   canAccessOperaciones: boolean,
 *   canAccessAsistencia: boolean,
 *   canAccessAcademia: boolean,
 *   canAccessBitacora: boolean,
 * }
 */
export async function PATCH(req: NextRequest) {
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
    const {
      operatorId,
      canAccessOperaciones = false,
      canAccessAsistencia = false,
      canAccessAcademia = false,
      canAccessBitacora = false,
    } = body as {
      operatorId?: string;
      canAccessOperaciones?: boolean;
      canAccessAsistencia?: boolean;
      canAccessAcademia?: boolean;
      canAccessBitacora?: boolean;
    };

    if (!operatorId) {
      return NextResponse.json({ error: "Se requiere operatorId" }, { status: 400 });
    }

    convex.setAuth(token);
    const permId = await convex.mutation(api.operatorPermissions.upsertPermissions, {
      operatorId: operatorId as Id<"users">,
      canAccessOperaciones,
      canAccessAsistencia,
      canAccessAcademia,
      canAccessBitacora,
    });

    return NextResponse.json({ success: true, permId }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg.includes("Solo un Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
