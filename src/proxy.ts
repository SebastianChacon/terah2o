import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/pricing",
  "/motor-inteligencia(.*)",
  "/api/gemini(.*)",
  "/api/weather(.*)",
  "/api/gemini-tts(.*)",
  "/api/gemini-stream(.*)",
  "/public(.*)",
]);

export const proxy = clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(request)) {
    // Redirigir usuario ya autenticado que visita /login
    if (pathname.startsWith("/login")) {
      const { userId } = await auth();
      if (userId) {
        const next =
          request.nextUrl.searchParams.get("next") ??
          request.nextUrl.searchParams.get("redirect_url");
        let dest = "/operaciones";
        if (next) {
          try {
            const parsed = next.startsWith("http")
              ? new URL(next).pathname
              : decodeURIComponent(next);
            if (parsed.startsWith("/") && !parsed.startsWith("//")) dest = parsed;
          } catch {
            if (next.startsWith("/") && !next.startsWith("//")) dest = next;
          }
        }
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }
    return NextResponse.next();
  }

  // Proteger todas las demás rutas — Clerk redirige a /login si no hay sesión
  await auth.protect();

  // Panel Owner (super-admin global): requiere login pero NO suscripción activa.
  // El dueño del sistema puede no tener una suscripción propia.
  if (pathname.startsWith("/owner") || pathname.startsWith("/api/owner")) {
    return NextResponse.next();
  }

  // Verificar suscripción (cookie escrita por useSubscription en el cliente).
  // Solo "active"/"trialing" tienen acceso. Un usuario recién registrado sin
  // plan ("none", "past_due", "canceled") se envía a /pricing — debe contratar
  // un plan antes de usar cualquier módulo.
  // `undefined` (cookie aún no escrita en la primerísima carga) se permite una
  // vez; el cliente fija la cookie en el primer render y las navegaciones
  // siguientes ya quedan bloqueadas si no hay plan.
  const subStatus = request.cookies.get("__convexSubStatus")?.value;
  if (subStatus && subStatus !== "active" && subStatus !== "trialing") {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
