"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { CreditCard, AlertTriangle, ShieldCheck, ShieldOff } from "lucide-react";

interface PaymentsViewProps {
  showToast: (msg: string, type: "success" | "error") => void;
}

export function PaymentsView({ showToast }: PaymentsViewProps) {
  const settings = useQuery(api.paymentSettings.getPaymentSettings) as
    | { payphoneEnabled: boolean; hasCredentials: boolean }
    | undefined;
  const setEnabled = useMutation(api.paymentSettings.setPayphoneEnabled);
  const [busy, setBusy] = useState(false);

  if (settings === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  async function toggle() {
    setBusy(true);
    try {
      await setEnabled({ enabled: !settings!.payphoneEnabled });
      showToast(
        settings!.payphoneEnabled ? "Payphone deshabilitado" : "Payphone habilitado",
        "success"
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-amber-200/70 text-xs leading-relaxed">
          Las credenciales de Payphone (Store ID, token) nunca se guardan en la base
          de datos ni pasan por el navegador. Se configuran como variables de entorno
          server-side en Convex (<code className="text-amber-300">PAYPHONE_STORE_ID</code>,{" "}
          <code className="text-amber-300">PAYPHONE_TOKEN</code>) vía{" "}
          <code className="text-amber-300">npx convex env set</code>. El cobro real no
          está implementado todavía — este panel solo prepara el terreno.
        </p>
      </div>

      <div className="bg-[#0a1120] border border-white/7 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-blue-400/70" />
          <h3 className="text-white text-sm font-semibold">Payphone</h3>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-white/50 text-xs">Credenciales configuradas</span>
          {settings.hasCredentials ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5" /> Sí
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-400 text-xs font-mono">
              <ShieldOff className="w-3.5 h-3.5" /> No
            </span>
          )}
        </div>

        <div className="flex items-center justify-between py-2 border-t border-white/5">
          <span className="text-white/50 text-xs">Habilitado</span>
          <button
            onClick={toggle}
            disabled={busy || (!settings.payphoneEnabled && !settings.hasCredentials)}
            title={
              !settings.hasCredentials && !settings.payphoneEnabled
                ? "Configura las env vars de Payphone en Convex primero"
                : undefined
            }
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              settings.payphoneEnabled
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                : "bg-white/3 border-white/10 text-white/40 hover:border-white/20"
            }`}
          >
            {busy ? "…" : settings.payphoneEnabled ? "Habilitado" : "Deshabilitado"}
          </button>
        </div>
      </div>
    </div>
  );
}
