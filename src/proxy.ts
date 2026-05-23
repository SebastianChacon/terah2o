import { NextRequest, NextResponse } from "next/server";

/**
 * Rutas públicas (no requieren autenticación ni suscripción).
 */
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/pricing",
  "/motor-inteligencia",
];

/**
 * Prefijos que siempre se bypasean (assets estáticos, APIs públicas).
 */
const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon",
  "/api/gemini",
  "/api/weather",
  "/api/gemini-tts",
  "/public",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Siempre permitir assets y APIs públicas
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Rutas exactamente públicas
  if (PUBLIC_ROUTES.includes(pathname)) {
    // Si el usuario ya tiene sesión y visita /login, redirigir al app.
    if (pathname === "/login") {
      const token =
        request.cookies.get("__convexAuthJWT")?.value ??
        request.cookies.get("__Host-ConvexAuthJWT")?.value;
      if (token) return NextResponse.redirect(new URL("/operaciones", request.url));
    }
    return NextResponse.next();
  }

  // ── Verificar sesión ───────────────────────────────────────────────────
  // @convex-dev/auth establece la cookie "__convexAuthJWT" al hacer signIn
  const token =
    request.cookies.get("__convexAuthJWT")?.value ??
    request.cookies.get("__Host-ConvexAuthJWT")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Verificar suscripción ──────────────────────────────────────────────
  // La cookie __convexSubStatus es escrita por useSubscription.ts en el cliente
  // tras cargar el estado real desde Convex. Es una capa UX (no de seguridad).
  // La seguridad real está en los handlers de Convex.
  const subStatus = request.cookies.get("__convexSubStatus")?.value;
  const hasValidSub = subStatus === "active" || subStatus === "trialing";

  if (!hasValidSub) {
    // Si hay token pero no hay cookie de suscripción aún (primera carga),
    // permitir el acceso para que el cliente pueda inicializar.
    // Solo bloqueamos si la cookie existe y tiene un estado inválido.
    if (subStatus && subStatus !== "none") {
      return NextResponse.redirect(new URL("/pricing", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
