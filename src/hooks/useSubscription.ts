"use client";

import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./useCurrentUser";
import type { Subscription } from "@/types/auth";

export interface UseSubscriptionResult {
  subscription: Subscription | null | undefined;
  isLoading: boolean;
  isActive: boolean;
}

/**
 * Hook de suscripcion.
 * Tambien escribe la cookie __convexSubStatus para que el middleware
 * pueda leerla en Edge Runtime sin llamadas asincronas.
 */
export function useSubscription(): UseSubscriptionResult {
  const { isAuthenticated, isLoading: userLoading } = useCurrentUser();

  const subscription = useQuery(
    api.subscriptions.getSubscription,
    isAuthenticated ? {} : "skip"
  ) as Subscription | null | undefined;

  // Sincronizar estado de suscripcion en cookie (leida por middleware)
  useEffect(() => {
    if (subscription === undefined) return; // aun cargando

    const status = subscription?.status ?? "none";
    // Cookie de sesion corta (sin httpOnly para que JS pueda escribirla)
    const maxAge = 60 * 60; // 1 hora
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `__convexSubStatus=${status};path=/;max-age=${maxAge};SameSite=Lax${secure}`;
  }, [subscription]);

  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";

  return {
    subscription: isAuthenticated ? subscription : null,
    isLoading: userLoading || (isAuthenticated && subscription === undefined),
    isActive,
  };
}
