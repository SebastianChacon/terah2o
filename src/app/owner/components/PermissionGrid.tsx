"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Check, X } from "lucide-react";
import type { OperatorPermissions } from "@/types/auth";
import { EMPTY_PERMS, type AccountRow } from "../types";

type PermKey = keyof OperatorPermissions;

const MAIN_TOGGLES: { key: PermKey; label: string }[] = [
  { key: "canAccessOperaciones", label: "Operaciones (hub)" },
  { key: "canAccessAsistencia", label: "Asistencia" },
  { key: "canAccessAcademia", label: "Academia" },
];

const SUB_TOGGLES: { key: PermKey; label: string }[] = [
  { key: "canAccessConsolaTecnica", label: "Consola Técnica" },
  { key: "canAccessHojaOperativa", label: "Hoja Operativa" },
  { key: "canAccessStock", label: "Stock & Kardex" },
  { key: "canAccessFinanzas", label: "Finanzas" },
  { key: "canAccessBitacora", label: "Bitácora" },
];

interface PermissionGridProps {
  row: AccountRow;
  onError: (message: string) => void;
}

export function PermissionGrid({ row, onError }: PermissionGridProps) {
  const setPerms = useMutation(api.superAdmin.setPermissionsGlobal);
  const [localPerms, setLocalPerms] = useState<OperatorPermissions | null>(null);
  const [saving, setSaving] = useState(false);

  const perms = localPerms ?? row.permissions ?? EMPTY_PERMS;

  async function handleToggle(key: PermKey, current: boolean) {
    const base = perms;
    const updated = { ...base, [key]: !current };
    setLocalPerms(updated);
    setSaving(true);
    try {
      await setPerms({ operatorId: row._id, ...updated });
    } catch (err: unknown) {
      setLocalPerms(base);
      onError(err instanceof Error ? err.message : "Error al guardar permisos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[#829ab1] text-[0.65rem] font-semibold uppercase tracking-wider mb-1.5">
          Módulos principales
        </p>
        <div className="grid grid-cols-3 gap-2">
          {MAIN_TOGGLES.map(({ key, label }) => {
            const val = perms[key];
            return (
              <button
                key={key}
                onClick={() => handleToggle(key, val)}
                disabled={saving}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  val
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-white border-[#dde4ec] text-[#829ab1] hover:border-[#c4cfda]"
                }`}
              >
                {val ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-[#829ab1] text-[0.65rem] font-semibold uppercase tracking-wider mb-1.5">
          Sub-módulos de Operaciones
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SUB_TOGGLES.map(({ key, label }) => {
            const val = perms[key];
            const opsBlocked = !perms.canAccessOperaciones;
            return (
              <button
                key={key}
                onClick={() => handleToggle(key, val)}
                disabled={saving || opsBlocked}
                title={
                  opsBlocked ? "Requiere permiso de Operaciones (hub)" : undefined
                }
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  opsBlocked
                    ? "opacity-40 cursor-not-allowed bg-white border-[#dde4ec] text-[#829ab1]"
                    : val
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-[#dde4ec] text-[#829ab1] hover:border-[#c4cfda]"
                }`}
              >
                {val && !opsBlocked ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
