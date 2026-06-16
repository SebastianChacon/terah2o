"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Gate de suscripción del lado cliente (backstop del proxy).
 *
 * El proxy bloquea por cookie, pero la cookie la escribe el cliente y puede no
 * existir en la primerísima carga. Este gate lee el estado real de la
 * suscripción desde Convex y, en cualquier ruta protegida, impide renderizar
 * los módulos y redirige a /pricing si el usuario autenticado NO tiene un plan
 * activo/trial. Aplica también a admins (un dueño recién registrado es admin
 * pero aún no tiene plan).
 *
 * Montado en el root, envuelve toda la app. Las rutas públicas y /owner quedan
 * exentas, igual que en el proxy.
 */

function isGatedPath(path: string): boolean {
  if (path === "/") return false;
  // Públicas + /owner (exento del gate de plan, igual que en el proxy)
  const exemptPrefixes = ["/login", "/pricing", "/motor-inteligencia", "/owner"];
  for (const p of exemptPrefixes) {
    if (path === p || path.startsWith(`${p}/`)) return false;
  }
  return true;
}

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-[#05051a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading: userLoading } = useCurrentUser();
  const { isActive, isLoading: subLoading } = useSubscription();

  const gated = isGatedPath(pathname);
  const checking = userLoading || subLoading;

  useEffect(() => {
    if (!gated || checking) return;
    // Usuarios no autenticados los maneja Clerk/proxy → /login.
    if (isAuthenticated && !isActive) router.replace("/pricing");
  }, [gated, checking, isAuthenticated, isActive, router]);

  if (gated) {
    // Mientras no se conozca el estado del plan, no mostrar módulos protegidos.
    if (checking) return <FullScreenSpinner />;
    // Autenticado sin plan activo → redirigiendo a /pricing.
    if (isAuthenticated && !isActive) return <FullScreenSpinner />;
  }

  return <>{children}</>;
}
