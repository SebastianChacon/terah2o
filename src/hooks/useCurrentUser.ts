"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { UserProfile } from "@/types/auth";

export interface UseCurrentUserResult {
  user: UserProfile | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Hook principal de autenticacion.
 * - isLoading: true mientras se resuelve la sesion o el perfil
 * - isAuthenticated: true si hay sesion activa de Convex Auth
 * - user: perfil del usuario (null si no esta autenticado, undefined mientras carga)
 */
export function useCurrentUser(): UseCurrentUserResult {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();

  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  ) as UserProfile | null | undefined;

  return {
    user: isAuthenticated ? user : null,
    isLoading: authLoading || (isAuthenticated && user === undefined),
    isAuthenticated,
  };
}
