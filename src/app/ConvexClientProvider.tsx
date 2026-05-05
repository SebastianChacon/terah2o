"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

// ── Cookie storage para @convex-dev/auth ──────────────────────────────────
// @convex-dev/auth guarda el JWT en localStorage por defecto usando claves
// largas como "__convexAuthJWT_https<serverUrl>". El middleware de Next.js
// corre en Edge Runtime (servidor) y sólo puede leer cookies HTTP, no
// localStorage. Mapeamos las claves a nombres cortos y las guardamos como
// cookies para que el middleware pueda verificar autenticación.
//
// Mapa de claves:
//   __convexAuthJWT_*            →  __convexAuthJWT
//   __convexAuthRefreshToken_*   →  __convexAuthRefreshToken
// ---------------------------------------------------------------------------

function mapCookieKey(key: string): string {
  if (key.startsWith("__convexAuthJWT_")) return "__convexAuthJWT";
  if (key.startsWith("__convexAuthRefreshToken_")) return "__convexAuthRefreshToken";
  return key;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(^| )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]+)")
  );
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  // 30 días · path raíz · SameSite=Lax (no HttpOnly — necesitamos leerlo en JS)
  // Secure is added on HTTPS so the JWT is never transmitted over plain HTTP.
  const maxAge = 60 * 60 * 24 * 30;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

const convexCookieStorage = {
  getItem(key: string): string | null {
    return getCookie(mapCookieKey(key));
  },
  setItem(key: string, value: string): void {
    setCookie(mapCookieKey(key), value);
  },
  removeItem(key: string): void {
    deleteCookie(mapCookieKey(key));
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
    <ConvexAuthProvider client={client} storage={convexCookieStorage}>
      {children}
    </ConvexAuthProvider>
  );
}
