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

  // Verificar suscripción (cookie escrita por useSubscription en el cliente)
  const subStatus = request.cookies.get("__convexSubStatus")?.value;
  if (subStatus && subStatus !== "none" && subStatus !== "active" && subStatus !== "trialing") {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
