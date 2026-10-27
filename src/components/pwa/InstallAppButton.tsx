"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Evento no estándar de Chrome/Edge/Android (no está en lib.dom).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS se presenta como Mac; se distingue por la pantalla táctil.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

type Platform = "server" | "standalone" | "ios" | "other";

const noSubscribe = () => () => {};
const getPlatform = (): Platform =>
  isStandalone() ? "standalone" : isIos() ? "ios" : "other";

/**
 * Botón "Instalar app". Chrome/Edge/Android: abre el diálogo nativo
 * (beforeinstallprompt). iPhone/iPad: Safari no tiene ese diálogo, así que
 * muestra los pasos para "Añadir a pantalla de inicio". No se muestra si la
 * app ya está instalada y abierta como app, ni en navegadores que no la
 * pueden instalar.
 */
export function InstallAppButton() {
  // Plataforma leída en el cliente ("server" durante el render en servidor).
  const platform = useSyncExternalStore(noSubscribe, getPlatform, () => "server" as const);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || platform === "server" || platform === "standalone") return null;
  if (!prompt && platform !== "ios") return null;

  const onClick = async () => {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null); // el evento solo se puede usar una vez
      return;
    }
    setShowIosHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        data-testid="install-app-button"
        className="inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[0.68rem] font-medium tracking-[0.2em] uppercase text-blue-300 bg-blue-500/[0.08] border border-blue-500/40 rounded-[3px] hover:bg-blue-500/[0.16] hover:text-blue-200 hover:border-blue-400 hover:shadow-[0_0_18px_rgba(59,130,246,0.25)] transition-all whitespace-nowrap"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        Instalar app
      </button>

      {showIosHelp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-[6px] border border-white/10 bg-[#0b0b2a] p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ios-install-title" className="text-[1rem] font-semibold">
              Instalar TeraH2O en iPhone / iPad
            </h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[0.85rem] leading-relaxed text-white/75">
              <li>Abra esta página en <strong>Safari</strong>.</li>
              <li>
                Toque el botón <strong>Compartir</strong> (el cuadro con una flecha hacia arriba).
              </li>
              <li>
                Elija <strong>Añadir a pantalla de inicio</strong> y luego <strong>Añadir</strong>.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="mt-6 w-full rounded-[3px] border border-white/15 py-2 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-white/80 hover:border-blue-500 hover:text-blue-300"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
