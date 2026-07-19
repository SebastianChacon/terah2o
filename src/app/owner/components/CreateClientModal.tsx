"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { X, UserPlus } from "lucide-react";
import type { PlanRow } from "../types";

interface CreateClientModalProps {
  onClose: () => void;
  onCreated: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}

export function CreateClientModal({
  onClose,
  onCreated,
  showToast,
}: CreateClientModalProps) {
  const plans = useQuery(api.plans.listPlans) as PlanRow[] | undefined;

  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [address, setAddress] = useState("");
  const [subType, setSubType] = useState<"operaciones" | "academia">("operaciones");
  const [planId, setPlanId] = useState("");
  const [trial, setTrial] = useState(true);
  const [busy, setBusy] = useState(false);

  const planOptions = useMemo(
    () => (plans ?? []).filter((p) => p.type === subType).sort((a, b) => a.order - b.order),
    [plans, subType]
  );

  const valid =
    orgName.trim() !== "" &&
    adminName.trim() !== "" &&
    /\S+@\S+\.\S+/.test(adminEmail.trim());

  function changeSubType(next: "operaciones" | "academia") {
    setSubType(next);
    setPlanId("");
  }

  async function handleCreate() {
    if (!valid) return;
    setBusy(true);
    try {
      const res = await fetch("/api/owner/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: orgName.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          cargo: cargo.trim() || undefined,
          phone: phone.trim() || undefined,
          region: region.trim() || undefined,
          address: address.trim() || undefined,
          planId: planId || undefined,
          trial,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        emailSent?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Error al crear cliente");
      showToast(
        data.emailSent
          ? `Cliente "${orgName.trim()}" creado e invitación enviada`
          : `Cliente "${orgName.trim()}" creado (correo no enviado)`,
        "success"
      );
      onCreated();
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Error al crear cliente",
        "error"
      );
      setBusy(false);
    }
  }

  const fieldClass =
    "w-full px-3 py-2.5 bg-white border border-[#c4cfda] rounded-lg text-[#102a43] text-sm placeholder:text-[#829ab1] focus:border-[#1666c4] focus:outline-none transition-colors";
  const labelClass =
    "block text-[#829ab1] text-[0.65rem] font-semibold uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={busy ? undefined : onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white border border-[#dde4ec] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-[#eef2f6] shrink-0">
          <h3 className="text-[#102a43] font-semibold text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#1666c4]" />
            Nuevo cliente
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-7 h-7 flex items-center justify-center text-[#829ab1] hover:text-[#334e68] disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-[#627d98] text-xs leading-relaxed">
            Crea una organización nueva con su administrador dueño. El admin recibe
            un correo y se vincula en su primer login.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Empresa / nombre</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="PTAP Ejemplo"
                disabled={busy}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Persona de contacto</label>
              <input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Juan Pérez"
                disabled={busy}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Cargo</label>
              <input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ej: Jefe de planta"
                disabled={busy}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+593 99 812 4477"
                disabled={busy}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Correo del administrador</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@ptap.ec"
                disabled={busy}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Región</label>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Provincia o ciudad"
                disabled={busy}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Dirección</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Dirección"
              disabled={busy}
              className={fieldClass}
            />
          </div>

          <div className="h-px bg-[#eef2f6]" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tipo de suscripción</label>
              <select
                value={subType}
                onChange={(e) => changeSubType(e.target.value as "operaciones" | "academia")}
                disabled={busy}
                className={fieldClass}
              >
                <option value="operaciones">Operaciones</option>
                <option value="academia">Academia</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Plan</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                disabled={busy || !plans}
                className={fieldClass}
              >
                <option value="">Sin plan asignado</option>
                {planOptions.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} — ${p.price}/mes
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#334e68] cursor-pointer">
            <input
              type="checkbox"
              checked={trial}
              onChange={(e) => setTrial(e.target.checked)}
              disabled={busy}
              className="w-4 h-4"
            />
            Iniciar con 14 días de prueba gratuita
          </label>

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-[#627d98] text-xs font-semibold hover:text-[#334e68] disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!valid || busy}
              className="px-4 py-2 bg-[#1666c4] text-white text-xs font-bold rounded-lg hover:bg-[#0f4c91] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {busy ? "Creando…" : "Crear cliente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
