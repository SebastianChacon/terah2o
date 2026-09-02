import type { NextConfig } from "next";

/**
 * Herramientas de cálculo servidas bajo el dominio principal.
 *
 * Son apps estáticas de un solo archivo, desplegadas en proyectos Vercel
 * aparte (repos TERAH2O/FILTROS-DE-ARENA, CALCULADORA-GRADIENTE, Simulador).
 * Se exponen como rutas del dominio en vez de enlazar los *.vercel.app.
 *
 * Rewrite y no redirect: la URL debe quedarse en terah2o.com. El origen
 * sigue siendo la fuente de verdad — si él redespliega una herramienta, el
 * cambio entra solo, sin tocar este repo.
 */
const HERRAMIENTAS = {
  "/filtro-de-agua": "https://filtros-de-arena.vercel.app",
  "/gradiente": "https://calculadora-gradiente.vercel.app",
  "/simulador": "https://simulador-neon.vercel.app",
} as const;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      ...Object.entries(HERRAMIENTAS).flatMap(([ruta, origen]) => [
        { source: ruta, destination: origen },
        { source: `${ruta}/:path*`, destination: `${origen}/:path*` },
      ]),
      // El HTML del gradiente pide "./support.js". Servido en /gradiente (sin
      // barra final) el navegador lo resuelve a /support.js, no a
      // /gradiente/support.js. No se arregla con trailingSlash: Next redirige
      // /gradiente/ -> /gradiente por defecto y pelearlo genera un bucle.
      // Mapear el asset en la raíz es la salida barata; la app no usa esa ruta.
      {
        source: "/support.js",
        destination: `${HERRAMIENTAS["/gradiente"]}/support.js`,
      },
    ];
  },
};

export default nextConfig;
