/*
 * Service worker de la app instalable (app.terah2o.com).
 *
 * Conservador a propósito: los datos viven en Convex (WebSocket a
 * *.convex.cloud, que este SW no toca) y las páginas dependen de la sesión.
 * - /_next/static/* e /icons/*: caché primero (llevan hash o no cambian).
 * - Navegación: siempre red; sin conexión, una pantalla "Sin conexión".
 * - Todo lo demás (/api, RSC, HTML autenticado): no se intercepta ni se guarda.
 *
 * La versión llega en ?v= al registrarlo (src/components/pwa/RegisterSW.tsx);
 * cada deploy crea una caché nueva y borra las anteriores.
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `terah2o-static-${VERSION}`;

const OFFLINE_HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión | TERAH2O</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05051a;color:#fff;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;padding:24px}
  .logo{font-size:2rem;font-weight:700;letter-spacing:.04em}
  .logo span{color:#3b82f6}
  p{color:rgba(255,255,255,.65);line-height:1.7;max-width:360px;margin:16px auto 28px}
  a{display:inline-block;padding:10px 20px;border:1px solid rgba(59,130,246,.5);border-radius:3px;
    color:#93c5fd;text-decoration:none;font:500 .75rem ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase}
</style></head>
<body><main>
  <div class="logo">TERA<span>H2O</span></div>
  <p>Sin conexión a internet. TeraH2O necesita conexión para mostrar los datos de su planta.</p>
  <a href="">Reintentar</a>
</main></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(["/icons/icon-192.png", "/icons/icon-512.png"])
      )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("terah2o-") && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// La app pide activar la versión nueva cuando el usuario acepta el aviso.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(OFFLINE_HTML, {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
      )
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
  }
});
