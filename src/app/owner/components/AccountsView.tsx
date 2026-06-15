"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Search,
  Trash2,
  Lock,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { AccountRow } from "../types";
import { PermissionGrid } from "./PermissionGrid";
import { RoleBadge, OwnerBadge, SubBadge } from "./shared";
import type { SubscriptionStatus, SubscriptionPlan } from "@/types/auth";

type RoleFilter = "all" | "admin" | "operator";

interface AccountsViewProps {
  showToast: (msg: string, type: "success" | "error") => void;
}

export function AccountsView({ showToast }: AccountsViewProps) {
  const accounts = useQuery(api.superAdmin.listAllUsers) as
    | AccountRow[]
    | undefined;
  const setRole = useMutation(api.superAdmin.setUserRoleGlobal);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    userId: Id<"users">;
    name: string;
  } | null>(null);
  const [roleTarget, setRoleTarget] = useState<{
    row: AccountRow;
    next: "admin" | "operator";
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (accounts ?? []).filter((a) => {
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (a.name ?? "").toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q) ||
        (a.orgName ?? "").toLowerCase().includes(q)
      );
    });
  }, [accounts, search, roleFilter]);

  async function confirmRole() {
    if (!roleTarget) return;
    const { row, next } = roleTarget;
    setBusyRole(row._id);
    try {
      await setRole({ userId: row._id, role: next });
      showToast(
        `${row.name ?? "Cuenta"} ahora es ${next === "admin" ? "administrador" : "operador"}`,
        "success"
      );
      setRoleTarget(null);
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Error al cambiar rol",
        "error"
      );
    } finally {
      setBusyRole(null);
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

  if (accounts === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Eliminar cuenta"
        message={
          deleteTarget
            ? `¿Eliminar la cuenta de ${deleteTarget.name}? Se borrará de Convex y de Clerk. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting !== null}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
      <ConfirmDialog
        isOpen={roleTarget !== null}
        title={roleTarget?.next === "admin" ? "Promover a admin" : "Degradar a operador"}
        message={
          roleTarget
            ? roleTarget.next === "admin"
              ? `${roleTarget.row.name ?? "Esta cuenta"} obtendrá acceso total a todos los módulos de su organización.`
              : `${roleTarget.row.name ?? "Esta cuenta"} perderá el acceso total y quedará con permisos de operador (todo bloqueado al inicio).`
            : ""
        }
        confirmLabel={roleTarget?.next === "admin" ? "Promover" : "Degradar"}
        variant={roleTarget?.next === "admin" ? "default" : "danger"}
        loading={busyRole !== null}
        onConfirm={confirmRole}
        onCancel={() => {
          if (!busyRole) setRoleTarget(null);
        }}
      />

      {/* Búsqueda + filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo u organización…"
            className="w-full pl-10 pr-3 py-2.5 bg-[#0a1120] border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-white/25 focus:border-amber-500/40 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["all", "Todos"],
              ["admin", "Admins"],
              ["operator", "Operadores"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRoleFilter(key)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                roleFilter === key
                  ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                  : "bg-white/[0.03] border border-white/8 text-white/40 hover:border-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-white/25 text-xs font-mono">
        {filtered.length} de {accounts.length} cuentas
      </p>

      <div className="space-y-3">
        {filtered.map((row) => {
          const isAdmin = row.role === "admin";
          const canDelete = !isAdmin || !row.isOrgOwner;
          const canChangeRole = !row.isOrgOwner; // el dueño no cambia de rol
          const nextRole: "admin" | "operator" = isAdmin ? "operator" : "admin";
          return (
            <div
              key={row._id}
              className="p-4 bg-[#0a1120] border border-white/7 rounded-xl"
            >
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold flex items-center gap-2 flex-wrap">
                    <span className="truncate">{row.name ?? "Sin nombre"}</span>
                    <RoleBadge isAdmin={isAdmin} />
                    {row.isOrgOwner && <OwnerBadge />}
                  </p>
                  <p className="text-white/30 text-xs font-mono truncate mt-0.5">
                    {row.email ?? "—"}
                    {row.orgName && (
                      <span className="text-white/20"> · {row.orgName}</span>
                    )}
                  </p>
                  <div className="mt-1.5">
                    <SubBadge
                      status={row.subStatus as SubscriptionStatus | null}
                      plan={row.subPlan as SubscriptionPlan | null}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() =>
                      canChangeRole && setRoleTarget({ row, next: nextRole })
                    }
                    disabled={!canChangeRole || busyRole === row._id}
                    title={
                      !canChangeRole
                        ? "No puedes cambiar el rol del dueño de la org"
                        : isAdmin
                          ? "Degradar a operador"
                          : "Promover a admin"
                    }
                    className="p-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/80 hover:border-white/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                  >
                    {busyRole === row._id ? (
                      <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isAdmin ? (
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                    )}
                  </button>
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
                      <Trash2 className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {isAdmin ? (
                <p className="text-violet-300/50 text-[0.65rem] font-mono uppercase tracking-widest">
                  Acceso total (admin)
                </p>
              ) : (
                <PermissionGrid
                  row={row}
                  onError={(msg) => showToast(msg, "error")}
                />
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-white/30 text-sm">
            No hay cuentas que coincidan.
          </div>
        )}
      </div>
    </div>
  );
}
