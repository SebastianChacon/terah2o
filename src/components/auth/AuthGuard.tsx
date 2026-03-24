"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { LockedModuleOverlay } from "./LockedModuleOverlay";
import type { PermissionKey } from "@/types/auth";

interface AuthGuardProps {
  permissionKey: PermissionKey;
  moduleName: string;
  children: React.ReactNode;
}

/**
 * Componente de guarda de acceso a nivel de módulo (capa cliente).
 * - Los admins siempre tienen acceso total.
 * - Los operadores son verificados contra su PermissionKey.
 *
 * El middleware.ts es la primera línea de defensa (redirige si no hay sesión).
 * AuthGuard es la segunda línea (muestra overlay si no hay permiso específico).
 */
export function AuthGuard({ permissionKey, moduleName, children }: AuthGuardProps) {
  const { user, isLoading } = useCurrentUser();
  const { can, isLoading: permsLoading } = usePermissions();

  // Mientras carga, no mostrar el overlay (evita flash)
  if (isLoading || permsLoading) {
    return <>{children}</>;
  }

  // Admins tienen acceso completo siempre
  if (user?.role === "admin") {
    return <>{children}</>;
  }

  // Operadores: verificar permiso específico
  const isLocked = !can(permissionKey);

  return (
    <LockedModuleOverlay moduleName={moduleName} isLocked={isLocked}>
      {children}
    </LockedModuleOverlay>
  );
}
