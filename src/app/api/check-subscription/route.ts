import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * GET /api/check-subscription
 * Devuelve el estado de suscripción del usuario autenticado.
 * Útil para validación en el cliente antes de renderizar componentes críticos.
 *
 * Response: { status: string, plan: string, isActive: boolean }
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("__convexAuthJWT")?.value;
    if (!token) {
      return NextResponse.json(
        { status: "none", plan: null, isActive: false },
        { status: 200 }
      );
    }

    convex.setAuth(token);
    const subscription = await convex.query(api.subscriptions.getSubscription, {});

    if (!subscription) {
      return NextResponse.json(
        { status: "none", plan: null, isActive: false },
        { status: 200 }
      );
    }

    const isActive =
      subscription.status === "active" || subscription.status === "trialing";

    return NextResponse.json(
      {
        status: subscription.status,
        plan: subscription.plan,
        isActive,
        trialEndsAt: subscription.trialEndsAt,
        expiresAt: subscription.expiresAt,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { status: "error", plan: null, isActive: false },
      { status: 500 }
    );
  }
}
