"use client";

import { useEffect, useState } from "react";
import { isPortadaHost } from "@/lib/hosts";

/**
 * Registra el service worker de la app instalable (public/sw.js).
 * Solo en producción y nunca en la portada (terah2o.com no se instala).
 * Cuando un deploy trae una versión nueva, avisa y recarga si el usuario acepta.
 */
export function RegisterSW() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    if (isPortadaHost(window.location.host)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const version = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
    navigator.serviceWorker
      .register(`/sw.js?v=${version}`, { scope: "/" })
      .then((reg) => {
        // Solo hay "versión nueva" si ya había un SW controlando la página.
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(sw);
            }
          });
        });
      })
      .catch(() => {
        // Sin SW la app funciona igual (solo pierde la pantalla sin conexión).
      });

    return () =>
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-[4px] border border-blue-500/40 bg-[#0b0b2a] px-4 py-3 text-[0.8rem] text-white shadow-lg"
    >
      Hay una versión nueva de TeraH2O.
      <button
        type="button"
        onClick={() => waiting.postMessage("SKIP_WAITING")}
        className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-blue-300 hover:text-blue-200"
      >
        Actualizar
      </button>
    </div>
  );
}
