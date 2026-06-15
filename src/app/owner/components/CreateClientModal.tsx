"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";

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
  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const valid =
    orgName.trim() !== "" &&
    adminName.trim() !== "" &&
    /\S+@\S+\.\S+/.test(adminEmail.trim());

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
    "w-full px-3 py-2.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-sm placeholder:text-white/25 focus:border-amber-500/40 focus:outline-none transition-colors";
  const labelClass =
    "block text-white/30 text-[0.6rem] font-mono uppercase tracking-widest mb-1.5";

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
        className="relative w-full max-w-md bg-[#0a1120] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-400/80" />
            Nuevo cliente
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-white/40 text-xs leading-relaxed">
            Crea una organización nueva con su administrador dueño y un trial de
            14 días. El admin recibe un correo y se vincula en su primer login.
          </p>
          <div>
            <label className={labelClass}>Nombre de la organización</label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="PTAP Ejemplo"
              disabled={busy}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Nombre del administrador</label>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Juan Pérez"
              disabled={busy}
              className={fieldClass}
            />
          </div>
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
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-white/40 text-[0.68rem] font-mono uppercase tracking-widest hover:text-white/60 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!valid || busy}
              className="px-4 py-2 border border-amber-500/30 bg-amber-500/20 text-amber-300 text-[0.68rem] font-bold uppercase tracking-widest rounded-lg hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {busy ? "Creando…" : "Crear cliente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
