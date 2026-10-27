import type { MetadataRoute } from "next";

/**
 * Manifest de la app instalable (PWA) de app.terah2o.com.
 * Next lo sirve en /manifest.webmanifest. En la portada (terah2o.com) el
 * proxy devuelve 404: la portada no se instala.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TeraH2O — Inteligencia Operativa",
    short_name: "TeraH2O",
    description:
      "Plataforma de optimización y control para plantas de tratamiento de agua potable.",
    lang: "es-EC",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#05051a",
    theme_color: "#05051a",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Operaciones", url: "/operaciones" },
      { name: "Calidad de Agua", url: "/asistencia" },
      { name: "Academia", url: "/academia" },
    ],
  };
}
