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
  const { user, isLoading } = useCurrentUser();
  const { can, isLoading: permsLoading } = usePermissions();

  if (isLoading || permsLoading) {
    return <>{children}</>;
  }

  if (user?.role === "admin") {
    return <>{children}</>;
  }

  const keys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];
  const isLocked = keys.some((k) => !can(k));

  return (
    <LockedModuleOverlay moduleName={moduleName} isLocked={isLocked}>
      {children}
    </LockedModuleOverlay>
  );
}
