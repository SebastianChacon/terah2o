"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NavbarUser } from "@/components/auth/NavbarUser";
import {
  ArrowLeft,
  Plus,
  UserCog,
  Check,
  X,
  Users,
  Trash2,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { OperatorPermissions } from "@/types/auth";

interface PermissionToggle {
  key: keyof OperatorPermissions;
  label: string;
}

const MAIN_PERMISSION_TOGGLES: PermissionToggle[] = [
  { key: "canAccessOperaciones", label: "Operaciones (hub)" },
  { key: "canAccessAsistencia", label: "Asistencia" },
  { key: "canAccessAcademia", label: "Academia" },
];

const SUBMODULE_PERMISSION_TOGGLES: PermissionToggle[] = [
  { key: "canAccessConsolaTecnica", label: "Consola Tecnica" },
  { key: "canAccessHojaOperativa", label: "Hoja Operativa" },
  { key: "canAccessStock", label: "Stock & Kardex" },
  { key: "canAccessFinanzas", label: "Finanzas" },
  { key: "canAccessBitacora", label: "Bitacora" },
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

const DEFAULT_MAX_ADMINS = 2;

interface DeleteTarget {
  operatorId: Id<"users">;
  name: string;
  clerkId?: string;
  email?: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();

  const operators = useQuery(api.users.getOperatorsByOrg) ?? [];
  const admins = useQuery(api.users.getAdminsByOrg) ?? [];
  const permsByOrg = useQuery(api.operatorPermissions.getPermissionsByOrg) ?? [];
  const upsertPerms = useMutation(api.operatorPermissions.upsertPermissions);
  const backfillPerms = useMutation(api.operatorPermissions.backfillOrganizationIds);
  const myOrg = useQuery(api.organizations.getMyOrganization);
  const { toast, showToast } = useToast();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [showInviteAdminForm, setShowInviteAdminForm] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [invitingAdmin, setInvitingAdmin] = useState(false);
  const [inviteAdminError, setInviteAdminError] = useState<string | null>(null);

  const [savingPerms, setSavingPerms] = useState<string | null>(null);
  const [deletingOperator, setDeletingOperator] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const submittingRef = useRef(false);
  const invitingRef = useRef(false);
  const backfillRanRef = useRef(false);

  const [localPerms, setLocalPerms] = useState<Record<string, OperatorPermissions>>({});

  useEffect(() => {
    if (isLoading || user?.role === "admin") return;
    if (user) {
      router.replace("/operaciones");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user?.role !== "admin" || backfillRanRef.current) return;
    backfillRanRef.current = true;
    backfillPerms({}).catch(() => {
      // Silencioso: el query ya incluye legacy por operador
    });
  }, [user?.role, backfillPerms]);

  function getPermsForOperator(operatorId: string): OperatorPermissions {
    if (localPerms[operatorId]) return localPerms[operatorId];
    const found = permsByOrg.find((p) => p.operatorId === operatorId);
    if (found) {
      return {
        canAccessOperaciones: found.canAccessOperaciones,
        canAccessAsistencia: found.canAccessAsistencia,
        canAccessAcademia: found.canAccessAcademia,
        canAccessBitacora: found.canAccessBitacora,
        canAccessConsolaTecnica: found.canAccessConsolaTecnica ?? false,
        canAccessHojaOperativa: found.canAccessHojaOperativa ?? false,
        canAccessStock: found.canAccessStock ?? false,
        canAccessFinanzas: found.canAccessFinanzas ?? false,
      };
    }
    return EMPTY_PERMS;
  }

  async function handleTogglePermission(
    operatorId: Id<"users">,
    key: keyof OperatorPermissions,
    currentValue: boolean
  ) {
    const current = getPermsForOperator(operatorId);
    const updated = { ...current, [key]: !currentValue };
    setLocalPerms((prev) => ({ ...prev, [operatorId]: updated }));

    setSavingPerms(operatorId);
    try {
      await upsertPerms({ operatorId, ...updated });
    } catch (err: unknown) {
      setLocalPerms((prev) => ({ ...prev, [operatorId]: current }));
      showToast(err instanceof Error ? err.message : "Error al guardar permisos", "error");
    } finally {
      setSavingPerms(null);
    }
  }

  async function handleCreateOperator(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!myOrg?._id) {
      showToast("Cargando datos de organizacion, intenta de nuevo", "error");
      return;
    }

    submittingRef.current = true;
    setCreating(true);
    setCreateError(null);
    const email = newEmail.trim().toLowerCase();
    try {
      const res = await fetch("/api/admin/create-operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: newName.trim(),
          organizationId: myOrg._id,
          orgName: myOrg.name,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        emailSent?: boolean;
        emailSkipReason?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Error al crear operador");

      setNewEmail("");
      setNewName("");
      setShowCreateForm(false);

      if (data.emailSent) {
        showToast(`Operador creado. Invitacion enviada a ${email}.`, "success");
      } else {
        showToast(
          `Operador creado. Debe registrarse en /login con ${email}.${data.emailSkipReason ? ` (${data.emailSkipReason})` : ""}`,
          "success"
        );
      }
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Error al crear operador");
    } finally {
      setCreating(false);
      submittingRef.current = false;
    }
  }

  async function handleInviteAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (invitingRef.current) return;
    if (!myOrg?._id) {
      showToast("Cargando datos de organizacion, intenta de nuevo", "error");
      return;
    }

    invitingRef.current = true;
    setInvitingAdmin(true);
    setInviteAdminError(null);
    const email = adminEmail.trim().toLowerCase();
    try {
      const res = await fetch("/api/admin/invite-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: adminName.trim(),
          organizationId: myOrg._id,
          orgName: myOrg.name,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        emailSent?: boolean;
        emailSkipReason?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Error al invitar administrador");

      setAdminEmail("");
      setAdminName("");
      setShowInviteAdminForm(false);

      if (data.emailSent) {
        showToast(`Administrador invitado. Correo enviado a ${email}.`, "success");
      } else {
        showToast(
          `Administrador invitado. Debe registrarse en /login con ${email}.${data.emailSkipReason ? ` (${data.emailSkipReason})` : ""}`,
          "success"
        );
      }
    } catch (err: unknown) {
      setInviteAdminError(
        err instanceof Error ? err.message : "Error al invitar administrador"
      );
    } finally {
      setInvitingAdmin(false);
      invitingRef.current = false;
    }
  }

  function requestDeleteOperator(target: DeleteTarget) {
    setDeleteTarget(target);
  }

  async function confirmDeleteOperator() {
    if (!deleteTarget) return;
    const { operatorId, name, clerkId, email } = deleteTarget;
    setDeletingOperator(operatorId);
    try {
      const res = await fetch("/api/admin/delete-operator", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatorId, clerkId, email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar operador");
      showToast(`Operador ${name} eliminado`, "success");
      setDeleteTarget(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al eliminar operador", "error");
    } finally {
      setDeletingOperator(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#05051a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  const operatorCount = operators.length;
  const maxOperators = myOrg?.maxOperators ?? 5;
  const maxAdmins = myOrg?.maxAdmins ?? DEFAULT_MAX_ADMINS;
  const adminCount = admins.length;
  const canInviteAdmin = adminCount < maxAdmins;
  const coAdmins = admins.filter((a) => a._id !== user?._id);

  // Entitlements de la org: techo de lo que el admin puede otorgar a operadores.
  const orgEnt: OperatorPermissions = {
    canAccessOperaciones: myOrg?.canAccessOperaciones ?? false,
    canAccessAsistencia: myOrg?.canAccessAsistencia ?? false,
    canAccessAcademia: myOrg?.canAccessAcademia ?? false,
    canAccessBitacora: myOrg?.canAccessBitacora ?? false,
    canAccessConsolaTecnica: myOrg?.canAccessConsolaTecnica ?? false,
    canAccessHojaOperativa: myOrg?.canAccessHojaOperativa ?? false,
    canAccessStock: myOrg?.canAccessStock ?? false,
    canAccessFinanzas: myOrg?.canAccessFinanzas ?? false,
  };

  return (
    <div className="min-h-screen bg-[#05051a] text-white">
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar operador"
        message={
          deleteTarget
            ? `¿Eliminar a ${deleteTarget.name}? Esta accion no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deletingOperator !== null}
        onConfirm={confirmDeleteOperator}
        onCancel={() => {
          if (!deletingOperator) setDeleteTarget(null);
        }}
      />

      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.05)_0%,transparent_60%)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        <nav className="flex items-center justify-between mb-10">
          <Link
            href="/operaciones"
            className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            Operaciones
          </Link>
          <NavbarUser />
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Panel de Administracion</h1>
          <p className="text-white/30 text-sm">
            {myOrg?.name ?? "Mi Organizacion"} ·{" "}
            <span className="text-blue-400/70">{operatorCount}/{maxOperators} operadores</span>
            {" · "}
            <span className="text-violet-400/70">{adminCount}/{maxAdmins} administradores</span>
          </p>
        </div>

        {/* Co-admins */}
        <div className="bg-[#0a1120] border border-white/7 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-violet-400" />
              <h2 className="text-white font-semibold text-sm uppercase tracking-widest">
                Administradores
              </h2>
            </div>
            {canInviteAdmin ? (
              <button
                onClick={() => setShowInviteAdminForm(!showInviteAdminForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[0.68rem] font-mono uppercase tracking-widest rounded-lg hover:bg-violet-500/20 transition-all"
              >
                <Plus className="w-3 h-3" />
                Invitar admin
              </button>
            ) : (
              <span className="text-[0.65rem] font-mono text-amber-400/60 uppercase tracking-widest">
                Limite de admins ({adminCount}/{maxAdmins})
              </span>
            )}
          </div>

          {showInviteAdminForm && (
            <form
              onSubmit={handleInviteAdmin}
              className="mb-5 p-4 bg-white/3 border border-white/6 rounded-xl"
            >
              <h3 className="text-white/60 text-xs font-mono uppercase tracking-widest mb-4">
                Invitar co-administrador
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-white/30 text-[0.65rem] font-mono uppercase tracking-widest mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    required
                    placeholder="Ing. Juan Perez"
                    className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-white/30 text-[0.65rem] font-mono uppercase tracking-widest mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    placeholder="admin@ptap.ec"
                    className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-all"
                  />
                </div>
              </div>
              {inviteAdminError && (
                <p className="text-red-400 text-xs mb-3">{inviteAdminError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={invitingAdmin}
                  className="px-4 py-2 bg-violet-500/20 border border-violet-500/30 text-violet-400 text-[0.68rem] font-bold uppercase tracking-widest rounded-lg hover:bg-violet-500/30 disabled:opacity-50 transition-all"
                >
                  {invitingAdmin ? "Enviando..." : "Enviar invitacion"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteAdminForm(false)}
                  className="px-4 py-2 text-white/30 text-[0.68rem] font-mono uppercase tracking-widest hover:text-white/50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {admins.map((admin) => (
              <div
                key={admin._id}
                className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-xl"
              >
                <div>
                  <p className="text-white text-sm font-semibold">
                    {admin.name ?? "Sin nombre"}
                    {admin._id === user?._id && (
                      <span className="ml-2 text-[0.6rem] font-mono text-violet-400/80 uppercase">
                        (tu)
                      </span>
                    )}
                  </p>
                  <p className="text-white/30 text-xs font-mono">{admin.email}</p>
                </div>
              </div>
            ))}
            {coAdmins.length === 0 && !showInviteAdminForm && (
              <p className="text-white/30 text-sm text-center py-4">
                Puedes invitar un co-administrador para gestionar la organizacion.
              </p>
            )}
          </div>
        </div>

        {/* Operadores */}
        <div className="bg-[#0a1120] border border-white/7 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold text-sm uppercase tracking-widest">
                Operadores
              </h2>
            </div>
            {operatorCount < maxOperators ? (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[0.68rem] font-mono uppercase tracking-widest rounded-lg hover:bg-blue-500/20 transition-all"
              >
                <Plus className="w-3 h-3" />
                Agregar
              </button>
            ) : (
              <span className="text-[0.65rem] font-mono text-amber-400/60 uppercase tracking-widest">
                Limite alcanzado ({operatorCount}/{maxOperators})
              </span>
            )}
          </div>

          {showCreateForm && (
            <form
              onSubmit={handleCreateOperator}
              className="mb-5 p-4 bg-white/3 border border-white/6 rounded-xl"
            >
              <h3 className="text-white/60 text-xs font-mono uppercase tracking-widest mb-4">
                Nuevo Operador
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-white/30 text-[0.65rem] font-mono uppercase tracking-widest mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    placeholder="Ing. Ana Torres"
                    className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-white/30 text-[0.65rem] font-mono uppercase tracking-widest mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    placeholder="operador@ptap.ec"
                    className="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-all"
                  />
                </div>
              </div>
              {createError && <p className="text-red-400 text-xs mb-3">{createError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[0.68rem] font-bold uppercase tracking-widest rounded-lg hover:bg-blue-500/30 disabled:opacity-50 transition-all"
                >
                  {creating ? "Creando..." : "Crear Operador"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-white/30 text-[0.68rem] font-mono uppercase tracking-widest hover:text-white/50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {operators.length === 0 ? (
            <div className="text-center py-8">
              <UserCog className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">Aun no has agregado operadores.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {operators.map((op) => {
                const perms = getPermsForOperator(op._id);
                const isSaving = savingPerms === op._id;
                return (
                  <div
                    key={op._id}
                    className="p-4 bg-white/2 border border-white/5 rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white text-sm font-semibold">
                          {op.name ?? "Sin nombre"}
                        </p>
                        <p className="text-white/30 text-xs font-mono">{op.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSaving && (
                          <div className="w-4 h-4 border border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        )}
                        <button
                          onClick={() =>
                            requestDeleteOperator({
                              operatorId: op._id as Id<"users">,
                              name: op.name ?? op.email ?? "operador",
                              clerkId: op.clerkId,
                              email: op.email,
                            })
                          }
                          disabled={deletingOperator === op._id}
                          title="Eliminar operador"
                          className="p-1.5 rounded-lg border border-red-500/20 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-30 transition-all"
                        >
                          {deletingOperator === op._id ? (
                            <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                    {/* Modulos principales */}
                    <div className="mb-2">
                      <p className="text-white/20 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
                        Modulos principales
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {MAIN_PERMISSION_TOGGLES.map(({ key, label }) => {
                          const val = perms[key];
                          const orgBlocked = !orgEnt[key];
                          return (
                            <button
                              key={key}
                              onClick={() =>
                                handleTogglePermission(op._id as Id<"users">, key, val)
                              }
                              disabled={isSaving || orgBlocked}
                              title={orgBlocked ? "Tu organizacion no tiene esta pagina" : undefined}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.65rem] font-mono uppercase tracking-wider transition-all ${
                                orgBlocked
                                  ? "opacity-40 cursor-not-allowed bg-white/3 border-white/8 text-white/20"
                                  : val
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : "bg-white/3 border-white/8 text-white/30 hover:border-white/20"
                              }`}
                            >
                              {val && !orgBlocked ? (
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
                    {/* Sub-modulos de Operaciones */}
                    <div>
                      <p className="text-white/20 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
                        Sub-modulos de Operaciones
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {SUBMODULE_PERMISSION_TOGGLES.map(({ key, label }) => {
                          const val = perms[key];
                          const orgBlocked = !orgEnt[key];
                          // Bitacora no es sub-modulo de Operaciones; el resto si.
                          const opsBlocked =
                            orgBlocked ||
                            (key !== "canAccessBitacora" && !perms.canAccessOperaciones);
                          return (
                            <button
                              key={key}
                              onClick={() =>
                                handleTogglePermission(op._id as Id<"users">, key, val)
                              }
                              disabled={isSaving || opsBlocked}
                              title={
                                orgBlocked
                                  ? "Tu organizacion no tiene esta pagina"
                                  : opsBlocked
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
