"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { NavbarUser } from "@/components/auth/NavbarUser";
import {
  ShieldAlert,
  Crown,
  Check,
  X,
  Trash2,
  Building2,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Id } from "../../../convex/_generated/dataModel";
import type { OperatorPermissions } from "@/types/auth";

type PermKey = keyof OperatorPermissions;

interface PermissionToggle {
  key: PermKey;
  label: string;
}

const MAIN_TOGGLES: PermissionToggle[] = [
  { key: "canAccessOperaciones", label: "Operaciones (hub)" },
  { key: "canAccessAsistencia", label: "Asistencia" },
  { key: "canAccessAcademia", label: "Academia" },
];

const SUB_TOGGLES: PermissionToggle[] = [
  { key: "canAccessConsolaTecnica", label: "Consola Técnica" },
  { key: "canAccessHojaOperativa", label: "Hoja Operativa" },
  { key: "canAccessStock", label: "Stock & Kardex" },
  { key: "canAccessFinanzas", label: "Finanzas" },
  { key: "canAccessBitacora", label: "Bitácora" },
];

const EMPTY_PERMS: OperatorPermissions = {
  canAccessOperaciones: false,
  canAccessAsistencia: false,
  canAccessAcademia: false,
  canAccessBitacora: false,
  canAccessConsolaTecnica: false,
  canAccessHojaOperativa: false,
  canAccessStock: false,
  canAccessFinanzas: false,
};

interface AccountRow {
  _id: Id<"users">;
  name: string | null;
  email: string | null;
  clerkId: string | null;
  role: "admin" | "operator";
  organizationId: Id<"organizations"> | null;
  orgName: string | null;
  isOrgOwner: boolean;
  subStatus: string | null;
  subPlan: string | null;
  permissions: OperatorPermissions | null;
}

interface DeleteTarget {
  userId: Id<"users">;
  name: string;
}

export default function OwnerPanelPage() {
  const isOwner = useQuery(api.superAdmin.amISuperAdmin);
  // listAllUsers lanza "No autorizado" para no-owners (seguridad). Saltarlo salvo que
  // seamos owner, para que la UI muestre "Acceso denegado" en vez de crashear.
  const accounts = useQuery(
    api.superAdmin.listAllUsers,
    isOwner ? {} : "skip"
  ) as AccountRow[] | undefined;
  const setPerms = useMutation(api.superAdmin.setPermissionsGlobal);
  const { toast, showToast } = useToast();

  const [localPerms, setLocalPerms] = useState<
    Record<string, OperatorPermissions>
  >({});
  const [savingPerms, setSavingPerms] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Gate de UI ──────────────────────────────────────────────────────────
  if (isOwner === undefined) {
    return (
      <div className="min-h-screen bg-[#05051a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (isOwner === false) {
    return (
      <div className="min-h-screen bg-[#05051a] text-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-12 h-12 text-red-400/70 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Acceso denegado</h1>
          <p className="text-white/40 text-sm">
            Esta área está reservada para el propietario del sistema.
          </p>
        </div>
      </div>
    );
  }

  function getPerms(row: AccountRow): OperatorPermissions {
    return localPerms[row._id] ?? row.permissions ?? EMPTY_PERMS;
  }

  async function handleToggle(row: AccountRow, key: PermKey, current: boolean) {
    const base = getPerms(row);
    const updated = { ...base, [key]: !current };
    setLocalPerms((prev) => ({ ...prev, [row._id]: updated }));
    setSavingPerms(row._id);
    try {
      await setPerms({ operatorId: row._id, ...updated });
    } catch (err: unknown) {
      setLocalPerms((prev) => ({ ...prev, [row._id]: base }));
      showToast(
        err instanceof Error ? err.message : "Error al guardar permisos",
        "error"
      );
    } finally {
      setSavingPerms(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { userId, name } = deleteTarget;
    setDeleting(userId);
    try {
      const res = await fetch("/api/owner/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar cuenta");
      showToast(`Cuenta de ${name} eliminada`, "success");
      setDeleteTarget(null);
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Error al eliminar cuenta",
        "error"
      );
    } finally {
      setDeleting(null);
    }
  }

  // ── Agrupar cuentas por organización ──────────────────────────────────────
  const groups = new Map<string, { orgName: string; rows: AccountRow[] }>();
  for (const row of accounts ?? []) {
    const key = row.organizationId ?? "__none__";
    const orgName = row.orgName ?? "Sin organización";
    if (!groups.has(key)) groups.set(key, { orgName, rows: [] });
    groups.get(key)!.rows.push(row);
  }
  const groupList = Array.from(groups.values()).sort((a, b) =>
    a.orgName.localeCompare(b.orgName)
  );

  const totalAccounts = accounts?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#05051a] text-white">
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar cuenta"
        message={
          deleteTarget
            ? `¿Eliminar la cuenta de ${deleteTarget.name}? Se borrará de Convex y de Clerk. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting !== null}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />

      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,158,11,0.06)_0%,transparent_60%)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        <nav className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2 text-amber-400/80">
            <Crown className="w-5 h-5" />
            <span className="text-sm font-mono uppercase tracking-widest">
              Panel Owner
            </span>
          </div>
          <NavbarUser />
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            Control global de cuentas
          </h1>
          <p className="text-white/30 text-sm">
            <span className="text-amber-400/70">{totalAccounts} cuentas</span> ·{" "}
            <span className="text-blue-400/70">
              {groupList.length} organizaciones
            </span>
          </p>
        </div>

        {totalAccounts === 0 && (
          <div className="text-center py-16 text-white/30 text-sm">
            No hay cuentas registradas todavía.
          </div>
        )}

        <div className="space-y-8">
          {groupList.map((group) => (
            <div key={group.orgName}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-400/70" />
                <h2 className="text-white/70 font-semibold text-xs uppercase tracking-widest">
                  {group.orgName}
                </h2>
                <span className="text-white/20 text-[0.65rem] font-mono">
                  {group.rows.length}
                </span>
              </div>

              <div className="space-y-3">
                {group.rows.map((row) => {
                  const isSaving = savingPerms === row._id;
                  const isAdmin = row.role === "admin";
                  const canDelete = !isAdmin || !row.isOrgOwner;
                  const perms = isAdmin ? null : getPerms(row);
                  return (
                    <div
                      key={row._id}
                      className="p-4 bg-[#0a1120] border border-white/7 rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-semibold flex items-center gap-2">
                            <span className="truncate">
                              {row.name ?? "Sin nombre"}
                            </span>
                            <span
                              className={`shrink-0 text-[0.55rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                isAdmin
                                  ? "bg-violet-500/15 text-violet-300"
                                  : "bg-blue-500/15 text-blue-300"
                              }`}
                            >
                              {isAdmin ? "Admin" : "Operador"}
                            </span>
                            {row.isOrgOwner && (
                              <span className="shrink-0 text-[0.55rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                                Dueño
                              </span>
                            )}
                          </p>
                          <p className="text-white/30 text-xs font-mono truncate">
                            {row.email ?? "—"}
                            {row.subStatus && (
                              <span className="text-white/20">
                                {" · "}
                                {row.subStatus}
                                {row.subPlan ? ` (${row.subPlan})` : ""}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isSaving && (
                            <div className="w-4 h-4 border border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
                          )}
                          <button
                            onClick={() =>
                              canDelete &&
                              setDeleteTarget({
                                userId: row._id,
                                name: row.name ?? row.email ?? "cuenta",
                              })
                            }
                            disabled={!canDelete || deleting === row._id}
                            title={
                              canDelete
                                ? "Eliminar cuenta"
                                : "No se puede eliminar al dueño de la organización"
                            }
                            className="p-1.5 rounded-lg border border-red-500/20 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                          >
                            {deleting === row._id ? (
                              <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                            ) : canDelete ? (
                              <Trash2 className="w-3 h-3" />
                            ) : (
                              <Lock className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {isAdmin ? (
                        <p className="text-violet-300/50 text-[0.65rem] font-mono uppercase tracking-widest">
                          Acceso total (admin)
                        </p>
                      ) : (
                        <>
                          <div className="mb-2">
                            <p className="text-white/20 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
                              Módulos principales
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {MAIN_TOGGLES.map(({ key, label }) => {
                                const val = perms![key];
                                return (
                                  <button
                                    key={key}
                                    onClick={() => handleToggle(row, key, val)}
                                    disabled={isSaving}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.65rem] font-mono uppercase tracking-wider transition-all ${
                                      val
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                        : "bg-white/3 border-white/8 text-white/30 hover:border-white/20"
                                    }`}
                                  >
                                    {val ? (
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
                          <div>
                            <p className="text-white/20 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
                              Sub-módulos de Operaciones
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                              {SUB_TOGGLES.map(({ key, label }) => {
                                const val = perms![key];
                                const opsBlocked = !perms!.canAccessOperaciones;
                                return (
                                  <button
                                    key={key}
                                    onClick={() => handleToggle(row, key, val)}
                                    disabled={isSaving || opsBlocked}
                                    title={
                                      opsBlocked
                                        ? "Requiere permiso de Operaciones (hub)"
                                        : undefined
                                    }
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.65rem] font-mono uppercase tracking-wider transition-all ${
                                      opsBlocked
                                        ? "opacity-40 cursor-not-allowed bg-white/3 border-white/8 text-white/20"
                                        : val
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                          : "bg-white/3 border-white/8 text-white/30 hover:border-white/20"
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
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
