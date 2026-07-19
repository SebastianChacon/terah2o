"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  ArrowLeft,
  Pencil,
  Check,
  Trash2,
  Crown,
  Users,
  X,
} from "lucide-react";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { AccountRow, AuditLogRow, OrgRow, PlanRow } from "../types";
import { clientStatus, formatDate, fromDateInput, toDateInput } from "../types";
import { PermissionGrid } from "./PermissionGrid";
import { RoleBadge, OwnerBadge, cardClass, inputClass, labelClass, primaryBtnClass, secondaryBtnClass, dangerBtnClass } from "./shared";
import type { OperatorPermissions, PermissionKey } from "@/types/auth";
import type { SubscriptionStatus, SubscriptionPlan } from "@/types/auth";

const ENT_MAIN: { key: PermissionKey; label: string }[] = [
  { key: "canAccessOperaciones", label: "Operaciones (hub)" },
  { key: "canAccessAsistencia", label: "Asistencia" },
  { key: "canAccessAcademia", label: "Academia" },
];
const ENT_SUB: { key: PermissionKey; label: string }[] = [
  { key: "canAccessConsolaTecnica", label: "Consola Técnica" },
  { key: "canAccessHojaOperativa", label: "Hoja Operativa" },
  { key: "canAccessStock", label: "Stock & Kardex" },
  { key: "canAccessFinanzas", label: "Finanzas" },
  { key: "canAccessBitacora", label: "Bitácora" },
];

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string }[] = [
  { value: "trialing", label: "Trial" },
  { value: "active", label: "Activa" },
  { value: "past_due", label: "Vencida" },
  { value: "canceled", label: "Cancelada" },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="font-semibold text-sm text-[#102a43] mb-1">{title}</div>
      {hint && <div className="text-xs text-[#829ab1] mb-4">{hint}</div>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}

// ── Información de contacto comercial (persona, cargo, teléfono, región) ───
function ContactInfoCard({
  org,
  showToast,
}: {
  org: OrgRow;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const setContactInfo = useMutation(api.superAdmin.setOrgContactInfo);

  const [contactCargo, setContactCargo] = useState(org.contactCargo ?? "");
  const [contactPhone, setContactPhone] = useState(org.contactPhone ?? "");
  const [region, setRegion] = useState(org.region ?? "");
  const [address, setAddress] = useState(org.address ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await setContactInfo({
        organizationId: org._id,
        contactCargo: contactCargo || undefined,
        contactPhone: contactPhone || undefined,
        region: region || undefined,
        address: address || undefined,
      });
      showToast("Datos de contacto guardados", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Información de contacto" hint="Persona de contacto y datos comerciales — no afecta cálculos ni accesos">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass}>Cargo</label>
          <input value={contactCargo} onChange={(e) => setContactCargo(e.target.value)} disabled={busy} placeholder="Ej: Jefe de planta" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Teléfono</label>
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} disabled={busy} placeholder="+593 99 812 4477" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Región</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} disabled={busy} placeholder="Provincia o ciudad" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Dirección</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} disabled={busy} placeholder="Dirección" className={inputClass} />
        </div>
      </div>
      <button onClick={save} disabled={busy} className={secondaryBtnClass}>
        Guardar contacto
      </button>
    </Section>
  );
}

// ── Suscripción: plan por caudal + estado/fechas en un solo formulario ──────
function SubscriptionCard({
  org,
  showToast,
}: {
  org: OrgRow;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const plans = useQuery(api.plans.listPlans) as PlanRow[] | undefined;
  const setPlan = useMutation(api.superAdmin.setOrgPlan);
  const setSub = useMutation(api.superAdmin.setSubscriptionGlobal);

  const [status, setStatus] = useState<SubscriptionStatus>(org.subscription?.status ?? "trialing");
  const [trialEndsAt, setTrialEndsAt] = useState(toDateInput(org.subscription?.trialEndsAt));
  const [expiresAt, setExpiresAt] = useState(toDateInput(org.subscription?.expiresAt));
  const [busy, setBusy] = useState(false);

  const legacyPlan: SubscriptionPlan = org.subscription?.plan ?? "starter";

  async function choosePlan(planId: string) {
    if (!planId) return;
    setBusy(true);
    try {
      await setPlan({ organizationId: org._id, planId: planId as Id<"plans"> });
      showToast("Plan actualizado", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveStatus() {
    setBusy(true);
    try {
      await setSub({
        organizationId: org._id,
        status,
        plan: legacyPlan,
        trialEndsAt: fromDateInput(trialEndsAt),
        expiresAt: fromDateInput(expiresAt),
      });
      showToast("Suscripción actualizada", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al guardar suscripción", "error");
    } finally {
      setBusy(false);
    }
  }

  async function extend30() {
    const base = status === "trialing" ? trialEndsAt : expiresAt;
    const baseTs = fromDateInput(base) ?? Date.now();
    const next = new Date(Math.max(baseTs, Date.now()) + 30 * 86_400_000);
    const nextStr = next.toISOString().slice(0, 10);
    if (status === "trialing") setTrialEndsAt(nextStr);
    else setExpiresAt(nextStr);
    setBusy(true);
    try {
      await setSub({
        organizationId: org._id,
        status,
        plan: legacyPlan,
        trialEndsAt: status === "trialing" ? fromDateInput(nextStr) : fromDateInput(trialEndsAt),
        expiresAt: status !== "trialing" ? fromDateInput(nextStr) : fromDateInput(expiresAt),
      });
      showToast("Vencimiento extendido 30 días", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Suscripción">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Plan asignado</label>
          <select
            value={org.subscription?.planId ?? ""}
            onChange={(e) => choosePlan(e.target.value)}
            disabled={busy || !plans}
            className={inputClass}
          >
            <option value="">Sin plan asignado</option>
            {(plans ?? []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} — ${p.price}/mes
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
            disabled={busy}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Fin de prueba</label>
          <input
            type="date"
            value={trialEndsAt}
            onChange={(e) => setTrialEndsAt(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Vencimiento</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={extend30} disabled={busy} className={secondaryBtnClass}>
          + 30 días
        </button>
        <button onClick={saveStatus} disabled={busy} className={primaryBtnClass}>
          {busy ? "Guardando…" : "Guardar suscripción"}
        </button>
      </div>
    </Section>
  );
}

// ── Contrato + perfil de planta (metadata comercial) ────────────────────────
function CommercialCard({
  org,
  showToast,
}: {
  org: OrgRow;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const plans = useQuery(api.plans.listPlans) as PlanRow[] | undefined;
  const setContract = useMutation(api.superAdmin.setOrgContract);
  const setPlantProfile = useMutation(api.superAdmin.setOrgPlantProfile);

  const [contractType, setContractType] = useState(org.contractType ?? "");
  const [contractNumber, setContractNumber] = useState(org.contractNumber ?? "");
  const [contractMonths, setContractMonths] = useState(org.contractMonths ? String(org.contractMonths) : "");
  const [caudalLs, setCaudalLs] = useState(org.plantProfile ? String(org.plantProfile.caudalLs) : "");
  const [coagType, setCoagType] = useState(org.plantProfile?.coagType ?? "");
  const [kgMonth, setKgMonth] = useState(org.plantProfile ? String(org.plantProfile.kgMonth) : "");
  const [habitantes, setHabitantes] = useState(org.plantProfile ? String(org.plantProfile.habitantes) : "");
  const [busy, setBusy] = useState(false);

  const suggested =
    plans && caudalLs
      ? plans
          .filter((p) => p.type === "operaciones")
          .find(
            (p) =>
              p.caudalMin !== undefined &&
              p.caudalMax !== undefined &&
              Number(caudalLs) >= p.caudalMin &&
              Number(caudalLs) < p.caudalMax
          )
      : undefined;

  async function saveContract() {
    setBusy(true);
    try {
      await setContract({
        organizationId: org._id,
        contractType: contractType ? (contractType as "directa" | "sercop") : undefined,
        contractNumber: contractNumber || undefined,
        contractMonths: contractMonths ? Number(contractMonths) : undefined,
      });
      showToast("Datos de contrato guardados", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function savePlantProfile() {
    if (!caudalLs || !coagType || !kgMonth || !habitantes) {
      showToast("Completa todos los campos del perfil de planta", "error");
      return;
    }
    setBusy(true);
    try {
      await setPlantProfile({
        organizationId: org._id,
        caudalLs: Number(caudalLs),
        coagType,
        kgMonth: Number(kgMonth),
        habitantes: Number(habitantes),
      });
      showToast("Perfil de planta guardado", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Datos del contrato y de la planta" hint="Metadata comercial — no afecta cálculos operativos">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className={labelClass}>Tipo de contratación</label>
          <select value={contractType} onChange={(e) => setContractType(e.target.value)} disabled={busy} className={inputClass}>
            <option value="">—</option>
            <option value="directa">Directa</option>
            <option value="sercop">SERCOP</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Número de contrato</label>
          <input value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} disabled={busy} placeholder="Ej: CTR-2026-014" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Duración (meses)</label>
          <input type="number" min={0} value={contractMonths} onChange={(e) => setContractMonths(e.target.value)} disabled={busy} placeholder="12" className={inputClass} />
        </div>
      </div>
      <button onClick={saveContract} disabled={busy} className={secondaryBtnClass}>
        Guardar contrato
      </button>

      <div className="h-px bg-[#eef2f6] my-5" />

      <label className={labelClass}>Datos de la planta</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1 mb-3">
        <input type="number" min={0} placeholder="Caudal (L/s)" value={caudalLs} onChange={(e) => setCaudalLs(e.target.value)} disabled={busy} className={inputClass} />
        <input placeholder="Coagulante" value={coagType} onChange={(e) => setCoagType(e.target.value)} disabled={busy} className={inputClass} />
        <input type="number" min={0} placeholder="Kg/mes" value={kgMonth} onChange={(e) => setKgMonth(e.target.value)} disabled={busy} className={inputClass} />
        <input type="number" min={0} placeholder="Habitantes" value={habitantes} onChange={(e) => setHabitantes(e.target.value)} disabled={busy} className={inputClass} />
      </div>
      {suggested && (
        <p className="text-xs text-[#15803d] mb-3">Sugerido por caudal: {suggested.name}</p>
      )}
      <button onClick={savePlantProfile} disabled={busy} className={secondaryBtnClass}>
        Guardar perfil de planta
      </button>
    </Section>
  );
}

function PermissionsCard({
  org,
  showToast,
}: {
  org: OrgRow;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const setEntitlements = useMutation(api.superAdmin.setOrgEntitlements);
  const [localEnt, setLocalEnt] = useState<OperatorPermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const ent = localEnt ?? org.entitlements;

  async function toggleEnt(key: PermissionKey, current: boolean) {
    const updated: OperatorPermissions = { ...ent, [key]: !current };
    if (key === "canAccessOperaciones" && current) {
      updated.canAccessConsolaTecnica = false;
      updated.canAccessHojaOperativa = false;
      updated.canAccessStock = false;
      updated.canAccessFinanzas = false;
    }
    setLocalEnt(updated);
    setSaving(true);
    try {
      await setEntitlements({ organizationId: org._id, ...updated });
    } catch (err: unknown) {
      setLocalEnt(ent);
      showToast(err instanceof Error ? err.message : "Error al guardar páginas", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Permisos de acceso" hint="Páginas habilitadas para esta organización — topa al admin y a sus operadores">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
        {ENT_MAIN.map(({ key, label }) => {
          const val = ent[key];
          return (
            <button
              key={key}
              onClick={() => toggleEnt(key, val)}
              disabled={saving}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${
                val ? "bg-[#e8f1fc] border-[#c5dbf5] text-[#0f4c91]" : "bg-white border-[#dde4ec] text-[#829ab1]"
              }`}
            >
              {label}
              <span
                className="w-9 h-5 rounded-full relative shrink-0 ml-2"
                style={{ background: val ? "#1666c4" : "#cbd5e1" }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: val ? "18px" : "2px" }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {ENT_SUB.map(({ key, label }) => {
          const val = ent[key];
          const opsBlocked = key !== "canAccessBitacora" && !ent.canAccessOperaciones;
          return (
            <button
              key={key}
              onClick={() => toggleEnt(key, val)}
              disabled={saving || opsBlocked}
              title={opsBlocked ? "Requiere Operaciones (hub)" : undefined}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                opsBlocked
                  ? "opacity-40 cursor-not-allowed bg-white border-[#dde4ec] text-[#829ab1]"
                  : val
                    ? "bg-[#e8f1fc] border-[#c5dbf5] text-[#0f4c91]"
                    : "bg-white border-[#dde4ec] text-[#829ab1]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function DeleteAccountModal({
  name,
  loading,
  onConfirm,
  onCancel,
}: {
  name: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={loading ? undefined : onCancel} aria-hidden />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white border border-red-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#eef2f6]">
          <h3 className="text-red-600 font-semibold text-sm">Eliminar cuenta</h3>
          <button onClick={onCancel} disabled={loading} className="w-7 h-7 flex items-center justify-center text-[#829ab1] hover:text-[#334e68] disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-[#486581] leading-relaxed mb-5">
            ¿Eliminar la cuenta de <strong className="text-[#102a43]">{name}</strong>? Se borrará de Convex y de Clerk.{" "}
            <span className="text-red-600">Esta acción no se puede deshacer.</span>
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} disabled={loading} className={secondaryBtnClass}>
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={loading} className={dangerBtnClass}>
              {loading ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamCard({
  org,
  members,
  showToast,
}: {
  org: OrgRow;
  members: AccountRow[];
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const setSeats = useMutation(api.superAdmin.setMaxOperators);
  const setAdminSeats = useMutation(api.superAdmin.setMaxAdmins);
  const setRole = useMutation(api.superAdmin.setUserRoleGlobal);
  const transfer = useMutation(api.superAdmin.transferOrgOwnership);

  const [seatsDraft, setSeatsDraft] = useState(String(org.maxOperators));
  const [adminSeatsDraft, setAdminSeatsDraft] = useState(String(org.maxAdmins));
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: Id<"users">; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const otherAdmins = members.filter((m) => m.role === "admin" && m._id !== org.adminUserId);

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

  async function saveAdminSeats() {
    const n = parseInt(adminSeatsDraft, 10);
    if (Number.isNaN(n) || n === org.maxAdmins) return;
    setBusy(true);
    try {
      await setAdminSeats({ organizationId: org._id, maxAdmins: n });
      showToast("Cupo de administradores actualizado", "success");
    } catch (err: unknown) {
      setAdminSeatsDraft(String(org.maxAdmins));
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer(newAdminUserId: string) {
    if (!newAdminUserId) return;
    setBusy(true);
    try {
      await transfer({ organizationId: org._id, newAdminUserId: newAdminUserId as Id<"users"> });
      showToast("Propiedad transferida", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRole(row: AccountRow) {
    const next = row.role === "admin" ? "operator" : "admin";
    setBusy(true);
    try {
      await setRole({ userId: row._id, role: next });
      showToast(`${row.name ?? "Cuenta"} ahora es ${next === "admin" ? "administrador" : "operador"}`, "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al cambiar rol", "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/owner/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTarget.userId }),
      });
      const data = (await res.json()) as { error?: string; warning?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar cuenta");
      if (data.warning) showToast(data.warning, "error");
      else showToast(`Cuenta de ${deleteTarget.name} eliminada`, "success");
      setDeleteTarget(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al eliminar cuenta", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Section title="Equipo de la cuenta" hint={`${org.adminCount} admin · ${org.operatorCount} operador(es)`}>
      {deleteTarget && (
        <DeleteAccountModal
          name={deleteTarget.name}
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <label className={labelClass}>Cupo de operadores</label>
          <div className="flex items-center gap-1.5">
            <input type="number" min={1} value={seatsDraft} onChange={(e) => setSeatsDraft(e.target.value)} disabled={busy} className={`${inputClass} w-20`} />
            <button onClick={saveSeats} disabled={busy || seatsDraft === String(org.maxOperators)} className={secondaryBtnClass}>
              Guardar
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass}>Cupo de administradores</label>
          <div className="flex items-center gap-1.5">
            <input type="number" min={1} value={adminSeatsDraft} onChange={(e) => setAdminSeatsDraft(e.target.value)} disabled={busy} className={`${inputClass} w-20`} />
            <button onClick={saveAdminSeats} disabled={busy || adminSeatsDraft === String(org.maxAdmins)} className={secondaryBtnClass}>
              Guardar
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass}>Transferir propiedad</label>
          <select value="" onChange={(e) => handleTransfer(e.target.value)} disabled={busy || otherAdmins.length === 0} className={inputClass}>
            <option value="">{otherAdmins.length === 0 ? "Sin otro admin disponible" : "Elegir nuevo dueño…"}</option>
            {otherAdmins.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name ?? a.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {members.map((m) => (
          <div key={m._id} className="border border-[#eef2f6] rounded-xl p-3.5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-sm text-[#102a43] truncate">{m.name ?? m.email ?? "—"}</span>
                <RoleBadge isAdmin={m.role === "admin"} />
                {m._id === org.adminUserId && <OwnerBadge />}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {m._id !== org.adminUserId && (
                  <>
                    <button
                      onClick={() => toggleRole(m)}
                      disabled={busy}
                      className="px-2.5 py-1 rounded-lg border border-[#c4cfda] text-[#486581] text-xs font-medium hover:border-[#1666c4] transition-colors"
                    >
                      {m.role === "admin" ? "Degradar" : "Promover"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ userId: m._id, name: m.name ?? m.email ?? "cuenta" })}
                      className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      title="Eliminar cuenta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
            {m.role === "operator" ? (
              <PermissionGrid row={m} onError={(msg) => showToast(msg, "error")} />
            ) : (
              <p className="text-xs text-violet-600 font-medium uppercase tracking-wide">Acceso total (admin)</p>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-[#829ab1]">Sin miembros.</p>}
      </div>
    </Section>
  );
}

function AuditLogCard({ org }: { org: OrgRow }) {
  const logs = useQuery(api.superAdmin.listOwnerAuditLog, { organizationId: org._id }) as AuditLogRow[] | undefined;
  return (
    <Section title="Bitácora de la cuenta" hint="Historial de cambios y acciones administrativas">
      {logs === undefined ? (
        <p className="text-sm text-[#829ab1]">Cargando…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-[#829ab1] italic">Sin movimientos registrados todavía.</p>
      ) : (
        <div className="space-y-1">
          {logs.map((l) => (
            <div key={l._id} className="flex gap-3 py-2 border-b border-[#f3f6f9] last:border-0 text-sm">
              <span className="font-mono text-xs text-[#829ab1] shrink-0 w-24">{formatDate(l.createdAt)}</span>
              <span className="text-[#334e68] flex-1 truncate">{l.text}</span>
              <span className="text-xs text-[#829ab1] shrink-0">{l.actorEmail}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

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
      const data = (await res.json()) as { error?: string; warning?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar organización");
      if (data.warning) showToast(data.warning, "error");
      else showToast(`Organización "${org.name}" eliminada`, "success");
      onDeleted();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error al eliminar organización", "error");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white border border-red-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#eef2f6]">
          <h3 className="text-red-600 font-semibold text-sm">Eliminar organización</h3>
          <button onClick={onClose} disabled={busy} className="w-7 h-7 flex items-center justify-center text-[#829ab1] hover:text-[#334e68]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-[#486581] leading-relaxed mb-4">
            Esto borra <strong className="text-[#102a43]">{org.name}</strong> por completo: {memberCount} cuenta(s),
            permisos, suscripción y todos sus datos operativos. <span className="text-red-600">Irreversible.</span>
          </p>
          <label className={labelClass}>Escribe el nombre exacto para confirmar</label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={org.name}
            disabled={busy}
            className={`${inputClass} mb-5`}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} disabled={busy} className={secondaryBtnClass}>
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={!confirmed || busy} className={dangerBtnClass}>
              {busy ? "Eliminando…" : "Eliminar org"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ClientDetailProps {
  org: OrgRow;
  members: AccountRow[];
  showToast: (msg: string, type: "success" | "error") => void;
  onBack: () => void;
}

export function ClientDetail({ org, members, showToast, onBack }: ClientDetailProps) {
  const rename = useMutation(api.superAdmin.renameOrganizationGlobal);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(org.name);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const st = useMemo(() => clientStatus(org.subscription), [org.subscription]);

  async function saveName() {
    if (nameDraft.trim() === org.name || !nameDraft.trim()) {
      setEditingName(false);
      setNameDraft(org.name);
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

  return (
    <div className="space-y-5 max-w-4xl">
      {deleteOpen && (
        <DeleteOrgModal org={org} onClose={() => setDeleteOpen(false)} onDeleted={onBack} showToast={showToast} />
      )}

      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-[#0f4c91] hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a clientes
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#e8f1fc] text-[#0f4c91] flex items-center justify-center font-bold text-lg shrink-0">
          {org.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                disabled={busy}
                autoFocus
                className="px-2 py-1 border border-[#c4cfda] rounded-lg text-lg font-semibold text-[#102a43] focus:border-[#1666c4] focus:outline-none"
              />
              <button onClick={saveName} disabled={busy} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setNameDraft(org.name);
                setEditingName(true);
              }}
              className="flex items-center gap-1.5 text-lg font-semibold text-[#102a43] hover:text-[#0f4c91] transition-colors group"
            >
              {org.name}
              <Pencil className="w-3.5 h-3.5 text-[#c4cfda] group-hover:text-[#0f4c91]" />
            </button>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-[#829ab1] flex-wrap">
            <span className="flex items-center gap-1"><Crown className="w-3 h-3 text-amber-500" />{org.ownerName ?? org.ownerEmail ?? "—"}{org.contactCargo ? ` · ${org.contactCargo}` : ""}</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{org.adminCount} admin · {org.operatorCount} op</span>
            <span>Creada {formatDate(org.createdAt)}</span>
          </div>
          {(org.contactPhone || org.address || org.region) && (
            <div className="text-[0.7rem] text-[#829ab1] mt-0.5">
              {[org.contactPhone, org.address, org.region].filter(Boolean).join("  ·  ")}
            </div>
          )}
        </div>
        <span className={`text-[0.7rem] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${st.className}`}>
          {st.label}
        </span>
      </div>

      <SubscriptionCard org={org} showToast={showToast} />
      <ContactInfoCard org={org} showToast={showToast} />
      <CommercialCard org={org} showToast={showToast} />
      <PermissionsCard org={org} showToast={showToast} />
      <TeamCard org={org} members={members} showToast={showToast} />
      <AuditLogCard org={org} />

      <div className={`${cardClass} p-5 flex items-center justify-between`}>
        <div>
          <p className="text-sm font-semibold text-red-600">Zona de riesgo</p>
          <p className="text-xs text-[#829ab1]">Elimina permanentemente esta organización y todos sus datos.</p>
        </div>
        <button onClick={() => setDeleteOpen(true)} className={`${dangerBtnClass} flex items-center gap-1.5`}>
          <Trash2 className="w-3.5 h-3.5" />
          Eliminar organización
        </button>
      </div>
    </div>
  );
}
