"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Building2,
  Trash2,
  Check,
  Pencil,
  Users,
  Crown,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { AccountRow, OrgRow } from "../types";
import { formatDate } from "../types";
import { SubBadge, RoleBadge, OwnerBadge } from "./shared";

interface OrganizationsViewProps {
  showToast: (msg: string, type: "success" | "error") => void;
}

// ── Modal de borrado de org con confirmación por tipeo ────────────────────
function DeleteOrgModal({
  org,
  onClose,
  onDeleted,
  showToast,
}: {
  org: OrgRow;
  onClose: () => void;
  onDeleted: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmed = typed.trim() === org.name;
  const memberCount = org.adminCount + org.operatorCount;

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await fetch("/api/owner/delete-org", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: org._id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar organización");
      showToast(`Organización "${org.name}" eliminada`, "success");
      onDeleted();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Error al eliminar organización",
        "error"
      );
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#05051a]/80 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md bg-[#0a1120] border border-red-500/20 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h3 className="text-red-300 font-semibold text-sm">
            Eliminar organización
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-white/50 text-sm leading-relaxed mb-4">
            Esto borra <strong className="text-white/80">{org.name}</strong> por
            completo: {memberCount} cuenta(s), permisos, suscripción y todos sus
            datos operativos. <span className="text-red-300/80">Irreversible.</span>
          </p>
          <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
            Escribe el nombre exacto para confirmar
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={org.name}
            disabled={busy}
            className="w-full px-3 py-2.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm placeholder:text-white/20 focus:border-red-500/40 focus:outline-none mb-5"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-white/40 text-[0.68rem] font-mono uppercase tracking-widest hover:text-white/60 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={!confirmed || busy}
              className="px-4 py-2 border border-red-500/30 bg-red-500/20 text-red-400 text-[0.68rem] font-bold uppercase tracking-widest rounded-lg hover:bg-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {busy ? "Eliminando…" : "Eliminar org"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrgCard({
  org,
  members,
  showToast,
}: {
  org: OrgRow;
  members: AccountRow[];
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const rename = useMutation(api.superAdmin.renameOrganizationGlobal);
  const setSeats = useMutation(api.superAdmin.setMaxOperators);
  const transfer = useMutation(api.superAdmin.transferOrgOwnership);

  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(org.name);
  const [seatsDraft, setSeatsDraft] = useState(String(org.maxOperators));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const otherAdmins = members.filter(
    (m) => m.role === "admin" && m._id !== org.adminUserId
  );

  async function saveName() {
    if (nameDraft.trim() === org.name) {
      setEditingName(false);
      return;
    }
    setBusy(true);
    try {
      await rename({ organizationId: org._id, name: nameDraft.trim() });
      showToast("Nombre actualizado", "success");
      setEditingName(false);
    } catch (err: unknown) {
      setNameDraft(org.name);
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveSeats() {
    const n = parseInt(seatsDraft, 10);
    if (Number.isNaN(n) || n === org.maxOperators) return;
    setBusy(true);
    try {
      await setSeats({ organizationId: org._id, maxOperators: n });
      showToast("Cupo de operadores actualizado", "success");
    } catch (err: unknown) {
      setSeatsDraft(String(org.maxOperators));
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer(newAdminUserId: string) {
    if (!newAdminUserId) return;
    setBusy(true);
    try {
      await transfer({
        organizationId: org._id,
        newAdminUserId: newAdminUserId as Id<"users">,
      });
      showToast("Propiedad transferida", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[#0a1120] border border-white/7 rounded-xl overflow-hidden">
      {deleteOpen && (
        <DeleteOrgModal
          org={org}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => setDeleteOpen(false)}
          showToast={showToast}
        />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-4 h-4 text-blue-400/70 shrink-0" />
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  disabled={busy}
                  className="px-2 py-1 bg-[#05051a] border border-white/15 rounded text-white text-sm focus:border-amber-500/40 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={saveName}
                  disabled={busy}
                  className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setNameDraft(org.name);
                  setEditingName(true);
                }}
                className="flex items-center gap-1.5 text-white text-sm font-semibold truncate hover:text-amber-300 transition-colors group"
              >
                <span className="truncate">{org.name}</span>
                <Pencil className="w-3 h-3 text-white/20 group-hover:text-amber-300/70" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SubBadge
              status={org.subscription?.status}
              plan={org.subscription?.plan}
            />
            <button
              onClick={() => setDeleteOpen(true)}
              title="Eliminar organización completa"
              className="p-1.5 rounded-lg border border-red-500/20 text-red-400/50 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="flex items-center gap-1.5 text-white/40">
            <Crown className="w-3 h-3 text-amber-400/60" />
            {org.ownerName ?? org.ownerEmail ?? "—"}
          </span>
          <span className="flex items-center gap-1.5 text-white/40">
            <Users className="w-3 h-3" />
            {org.adminCount} admin · {org.operatorCount} op
          </span>
          <span className="text-white/25">Creada {formatDate(org.createdAt)}</span>
        </div>

        {/* Controles: seats + transferir */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
              Cupo de operadores
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                value={seatsDraft}
                onChange={(e) => setSeatsDraft(e.target.value)}
                disabled={busy}
                className="w-20 px-2 py-1.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm focus:border-amber-500/40 focus:outline-none"
              />
              <button
                onClick={saveSeats}
                disabled={busy || seatsDraft === String(org.maxOperators)}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 text-white/50 text-xs hover:border-white/30 disabled:opacity-30 transition-all"
              >
                Guardar
              </button>
            </div>
          </div>
          <div>
            <label className="block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5">
              Transferir propiedad
            </label>
            <select
              value=""
              onChange={(e) => handleTransfer(e.target.value)}
              disabled={busy || otherAdmins.length === 0}
              className="w-full px-2 py-1.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm focus:border-amber-500/40 focus:outline-none disabled:opacity-40"
            >
              <option value="">
                {otherAdmins.length === 0
                  ? "Sin otro admin disponible"
                  : "Elegir nuevo dueño…"}
              </option>
              {otherAdmins.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name ?? a.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Miembros */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 mt-4 text-white/40 text-xs hover:text-white/70 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          {expanded ? "Ocultar" : "Ver"} miembros ({members.length})
        </button>
        {expanded && (
          <div className="mt-3 space-y-1.5 pl-1">
            {members.map((m) => (
              <div
                key={m._id}
                className="flex items-center gap-2 text-xs text-white/50"
              >
                <span className="truncate">{m.name ?? m.email ?? "—"}</span>
                <RoleBadge isAdmin={m.role === "admin"} />
                {m._id === org.adminUserId && <OwnerBadge />}
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-white/25 text-xs">Sin miembros.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function OrganizationsView({ showToast }: OrganizationsViewProps) {
  const orgs = useQuery(api.superAdmin.listOrganizations) as
    | OrgRow[]
    | undefined;
  const accounts = useQuery(api.superAdmin.listAllUsers) as
    | AccountRow[]
    | undefined;

  const membersByOrg = useMemo(() => {
    const map = new Map<string, AccountRow[]>();
    for (const a of accounts ?? []) {
      if (!a.organizationId) continue;
      const arr = map.get(a.organizationId) ?? [];
      arr.push(a);
      map.set(a.organizationId, arr);
    }
    return map;
  }, [accounts]);

  if (orgs === undefined || accounts === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-white/25 text-xs font-mono">
        {orgs.length} organizaciones
      </p>
      {orgs.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">
          No hay organizaciones todavía.
        </div>
      ) : (
        orgs.map((org) => (
          <OrgCard
            key={org._id}
            org={org}
            members={membersByOrg.get(org._id) ?? []}
            showToast={showToast}
          />
        ))
      )}
    </div>
  );
}
