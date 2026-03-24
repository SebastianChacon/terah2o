"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./useCurrentUser";
import type { OperatorPermissions, PermissionKey } from "@/types/auth";

export interface UsePermissionsResult {
  permissions: OperatorPermissions | null | undefined;
  isLoading: boolean;
  can: (key: PermissionKey) => boolean;
}

/**
 * Hook de permisos.
 * - Los admins reciben permisos completos directamente desde la query Convex.
 * - Los operadores reciben sus flags específicos.
 * - can(key) devuelve true si el usuario tiene ese permiso (o es admin).
 */
export function usePermissions(): UsePermissionsResult {
  const { isAuthenticated, isLoading: userLoading } = useCurrentUser();

  const permissions = useQuery(
    api.operatorPermissions.getMyPermissions,
    isAuthenticated ? {} : "skip"
  ) as OperatorPermissions | null | undefined;

  const can = (key: PermissionKey): boolean => {
    if (!permissions) return false;
    return permissions[key] === true;
  };

  return {
    permissions: isAuthenticated ? permissions : null,
    isLoading: userLoading || (isAuthenticated && permissions === undefined),
    can,
  };
}
