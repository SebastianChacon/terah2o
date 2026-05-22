"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

// ── Hybrid storage para @convex-dev/auth ──────────────────────────────────
// La librería guarda tokens con claves como "__convexAuthJWT_https<url>".
// Problema: usar solo cookies hacía que `isAuthenticated` nunca fuera `true`
// porque la librería no podía restaurar el estado en el ciclo de vida React.
//
// Solución: localStorage como almacenamiento primario (para que isAuthenticated
// funcione correctamente) + cookies como espejo del JWT y refresh token (para
// que el proxy de Next.js pueda leer la sesión en Edge Runtime).
//
// Mapa de claves → cookies (espejo):
//   __convexAuthJWT_*            →  __convexAuthJWT
//   __convexAuthRefreshToken_*   →  __convexAuthRefreshToken
// ---------------------------------------------------------------------------

function needsCookieMirror(key: string): boolean {
  return (
    key.startsWith("__convexAuthJWT_") ||
    key.startsWith("__convexAuthRefreshToken_")
  );
}

function cookieName(key: string): string {
  if (key.startsWith("__convexAuthJWT_")) return "__convexAuthJWT";
  if (key.startsWith("__convexAuthRefreshToken_")) return "__convexAuthRefreshToken";
  return key;
}

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 30;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

const convexHybridStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
    if (needsCookieMirror(key)) setCookie(cookieName(key), value);
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    if (needsCookieMirror(key)) deleteCookie(cookieName(key));
  },
};

// ---------------------------------------------------------------------------

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  if (!client) {
    return <>{children}</>;
  }

  return (
    <ConvexAuthProvider client={client} storage={convexHybridStorage}>
      {children}
    </ConvexAuthProvider>
  );
}
