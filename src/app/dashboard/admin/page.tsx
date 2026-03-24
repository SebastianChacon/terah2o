"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { ArrowLeft, Plus, UserCog, Check, X, Users } from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { OperatorPermissions } from "@/types/auth";

interface PermissionToggle {
  key: keyof OperatorPermissions;
  label: string;
}

const PERMISSION_TOGGLES: PermissionToggle[] = [
  { key: "canAccessOperaciones", label: "Operaciones" },
  { key: "canAccessAsistencia", label: "Asistencia" },
  { key: "canAccessAcademia", label: "Academia" },
  { key: "canAccessBitacora", label: "Bitácora" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUser();

  // Hooks siempre antes de cualquier return condicional (Rules of Hooks)
  const operators = useQuery(api.users.getOperatorsByOrg) ?? [];
  const permsByOrg = useQuery(api.operatorPermissions.getPermissionsByOrg) ?? [];
  const upsertPerms = useMutation(api.operatorPermissions.upsertPermissions);
  const createOperator = useMutation(api.users.createOperator);
  const myOrg = useQuery(api.organizations.getMyOrganization);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [savingPerms, setSavingPerms] = useState<string | null>(null);

  // Estado local de permisos (optimistic)
  const [localPerms, setLocalPerms] = useState<Record<string, OperatorPermissions>>({});

  function getPermsForOperator(operatorId: string): OperatorPermissions {
    if (localPerms[operatorId]) return localPerms[operatorId];
    const found = permsByOrg.find((p) => p.operatorId === operatorId);
    return found ?? {
      canAccessOperaciones: false,
      canAccessAsistencia: false,
      canAccessAcademia: false,
      canAccessBitacora: false,
    };
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
    } catch {
      // Revertir en caso de error
      setLocalPerms((prev) => ({ ...prev, [operatorId]: current }));
    } finally {
      setSavingPerms(null);
    }
  }

  async function handleCreateOperator(e: React.FormEvent) {
    e.preventDefault();
    if (!myOrg?._id) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createOperator({
        email: newEmail,
        name: newName,
        organizationId: myOrg._id,
      });
      setNewEmail("");
      setNewName("");
      setShowCreateForm(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Error al crear operador");
    } finally {
      setCreating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#05051a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Redirigir si no es admin (aquí ya terminaron todos los hooks)
  if (user?.role !== "admin") {
    router.replace("/operaciones");
    return null;
  }

  const operatorCount = operators.length;
  const maxOperators = myOrg?.maxOperators ?? 5;

  return (
    <div className="min-h-screen bg-[#05051a] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.05)_0%,transparent_60%)]" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        {/* Navbar */}
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

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Panel de Administración</h1>
          <p className="text-white/30 text-sm">
            {myOrg?.name ?? "Mi Organización"} ·{" "}
            <span className="text-blue-400/70">{operatorCount}/{maxOperators} operadores</span>
          </p>
        </div>

        {/* Sección de operadores */}
        <div className="bg-[#0a1120] border border-white/[0.07] rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold text-sm uppercase tracking-widest">
                Operadores
              </h2>
            </div>
            {operatorCount < maxOperators && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[0.68rem] font-mono uppercase tracking-widest rounded-lg hover:bg-blue-500/20 transition-all"
              >
                <Plus className="w-3 h-3" />
                Agregar
              </button>
            )}
          </div>

          {/* Formulario de creación */}
          {showCreateForm && (
            <form onSubmit={handleCreateOperator} className="mb-5 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl">
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
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-all"
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
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-all"
                  />
                </div>
              </div>
              {createError && (
                <p className="text-red-400 text-xs mb-3">{createError}</p>
              )}
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

          {/* Lista de operadores */}
          {operators.length === 0 ? (
            <div className="text-center py-8">
              <UserCog className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">
                Aún no has agregado operadores.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {operators.map((op) => {
                const perms = getPermsForOperator(op._id);
                const isSaving = savingPerms === op._id;
                return (
                  <div
                    key={op._id}
                    className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white text-sm font-semibold">{op.name ?? "Sin nombre"}</p>
                        <p className="text-white/30 text-xs font-mono">{op.email}</p>
                      </div>
                      {isSaving && (
                        <div className="w-4 h-4 border border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                      )}
                    </div>
                    {/* Permisos */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {PERMISSION_TOGGLES.map(({ key, label }) => {
                        const val = perms[key];
                        return (
                          <button
                            key={key}
                            onClick={() => handleTogglePermission(op._id as Id<"users">, key, val)}
                            disabled={isSaving}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[0.65rem] font-mono uppercase tracking-wider transition-all ${
                              val
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:border-white/20"
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
