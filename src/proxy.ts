import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/pricing",
  // /motor-inteligencia ya NO es público: requiere login + suscripción activa,
  // igual que el resto de módulos. El gate (proxy por cookie + SubscriptionGate)
  // lo bloquea y redirige a /pricing si no hay plan.
  "/api/gemini(.*)",
  "/api/weather(.*)",
  "/api/gemini-tts(.*)",
  "/api/gemini-stream(.*)",
  "/public(.*)",
  // Herramientas de cálculo (rewrites en next.config.ts hacia sus despliegues).
  // Son públicas a propósito: la portada las ofrece como gancho, sin cuenta.
  // El proxy corre ANTES de los rewrites, así que sin esto Clerk las mandaría
  // a /login y la herramienta nunca se cargaría.
  "/filtro-de-agua(.*)",
  "/gradiente(.*)",
  "/simulador(.*)",
  "/support.js",
  // Presentación institucional: la página y el PDF que descarga. Van enlazadas
  // desde el home, que es público — sin esto el proxy las manda a /login y el
  // visitante anónimo nunca las ve. Es material comercial, no un módulo
  // operativo. El mismo PDF ya se sirve abierto desde la portada.
  "/presentacion",
  "/TERAH2O-Brochure.pdf",
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

  // Proteger todas las demás rutas.
  //
  // NO usar auth.protect(): delega en el handshake de Clerk, y con una instancia
  // de desarrollo (pk_test) sobre un dominio real ese handshake no puede
  // completarse — Clerk responde `x-clerk-auth-reason: dev-browser-missing` y
  // reescribe a 404. Resultado: un visitante anónimo que abre /operaciones ve
  // un 404 en vez del login. El redirect explícito no depende del handshake y
  // se comporta igual en dev, en preview y en producción.
  const { userId } = await auth();
  if (!userId) {
    // Una API no puede "redirigir a login": el cliente espera JSON.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("redirect_url", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

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
