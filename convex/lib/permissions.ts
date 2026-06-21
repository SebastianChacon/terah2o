// convex/lib/permissions.ts
// Helpers de permisos compartidos por las funciones del backend Convex.
// (El backend Convex es un grafo de módulos aparte de src/, por eso esta lógica
//  se duplica intencionalmente con src/types/auth.ts.)

export interface ModulePerms {
  canAccessOperaciones: boolean;
  canAccessAsistencia: boolean;
  canAccessAcademia: boolean;
  canAccessBitacora: boolean;
  canAccessConsolaTecnica: boolean;
  canAccessHojaOperativa: boolean;
  canAccessStock: boolean;
  canAccessFinanzas: boolean;
}

export const MODULE_PERMISSION_KEYS: (keyof ModulePerms)[] = [
  "canAccessOperaciones",
  "canAccessAsistencia",
  "canAccessAcademia",
  "canAccessBitacora",
  "canAccessConsolaTecnica",
  "canAccessHojaOperativa",
  "canAccessStock",
  "canAccessFinanzas",
];

/** Lee los 8 flags de un objeto (org doc, perms row…); ausente ⇒ false. */
export function readPerms(src: Partial<ModulePerms> | null | undefined): ModulePerms {
  return {
    canAccessOperaciones: src?.canAccessOperaciones === true,
    canAccessAsistencia: src?.canAccessAsistencia === true,
    canAccessAcademia: src?.canAccessAcademia === true,
    canAccessBitacora: src?.canAccessBitacora === true,
    canAccessConsolaTecnica: src?.canAccessConsolaTecnica === true,
    canAccessHojaOperativa: src?.canAccessHojaOperativa === true,
    canAccessStock: src?.canAccessStock === true,
    canAccessFinanzas: src?.canAccessFinanzas === true,
  };
}

/** Si Operaciones (hub) está apagado, los 4 sub-módulos quedan apagados. */
export function normalizePerms(p: ModulePerms): ModulePerms {
  const ops = p.canAccessOperaciones === true;
  return {
    canAccessOperaciones: ops,
    canAccessAsistencia: p.canAccessAsistencia === true,
    canAccessAcademia: p.canAccessAcademia === true,
    canAccessBitacora: p.canAccessBitacora === true,
    canAccessConsolaTecnica: ops && p.canAccessConsolaTecnica === true,
    canAccessHojaOperativa: ops && p.canAccessHojaOperativa === true,
    canAccessStock: ops && p.canAccessStock === true,
    canAccessFinanzas: ops && p.canAccessFinanzas === true,
  };
}

/** resultado[k] = requested[k] && cap[k]. Nadie excede los entitlements de la org. */
export function clampPerms(requested: ModulePerms, cap: ModulePerms): ModulePerms {
  const out = {} as ModulePerms;
  for (const k of MODULE_PERMISSION_KEYS) {
    out[k] = requested[k] === true && cap[k] === true;
  }
  return normalizePerms(out);
}
