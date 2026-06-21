"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { LockedModuleOverlay } from "./LockedModuleOverlay";
import type { PermissionKey } from "@/types/auth";

interface AuthGuardProps {
  // Single key or multiple keys — ALL must be true to grant access
  permissionKey: PermissionKey | PermissionKey[];
  moduleName: string;
  children: React.ReactNode;
}

export function AuthGuard({ permissionKey, moduleName, children }: AuthGuardProps) {
  const { isLoading } = useCurrentUser();
  const { can, isLoading: permsLoading } = usePermissions();

  if (isLoading || permsLoading) {
    return <>{children}</>;
  }

  // Sin bypass de admin: admin y operador se gatean por los permisos efectivos
  // (para el admin estos equivalen a los entitlements de su organización, que
  // define el Owner). El panel /dashboard/admin y /owner no usan AuthGuard con
  // llaves de módulo, así que la gestión sigue accesible.
  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  const isLocked = keys.some((k) => !can(k));

  return (
    <LockedModuleOverlay moduleName={moduleName} isLocked={isLocked}>
      {children}
    </LockedModuleOverlay>
  );
}
