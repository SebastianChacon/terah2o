/**
 * Mapa de dominios (ver PLAN-app-y-portada.md).
 *
 * - terah2o.com      → portada pública (presentación + accesos a herramientas)
 * - www.terah2o.com  → redirige a terah2o.com
 * - app.terah2o.com  → el sistema (instalable como app)
 *
 * Cualquier otro host (previews *.vercel.app, localhost) se trata como app:
 * así los previews siguen funcionando y la portada se puede probar en
 * /presentacion. NEXT_PUBLIC_PORTADA_HOSTS permite simular la portada en local
 * (p.ej. "portada.localhost").
 */

export const PORTADA_ORIGIN =
  process.env.NEXT_PUBLIC_PORTADA_ORIGIN ?? "https://terah2o.com";

export const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://app.terah2o.com";

const PORTADA_HOSTS = (
  process.env.NEXT_PUBLIC_PORTADA_HOSTS ?? "terah2o.com,www.terah2o.com"
)
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** Quita el puerto y normaliza: "Terah2o.com:443" → "terah2o.com". */
function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").toLowerCase().split(":")[0];
}

export function isPortadaHost(host: string | null | undefined): boolean {
  return PORTADA_HOSTS.includes(normalizeHost(host));
}

export function isWwwHost(host: string | null | undefined): boolean {
  return normalizeHost(host).startsWith("www.");
}
