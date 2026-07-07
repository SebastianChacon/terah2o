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
        <div className="w-8 h-8 border-2 border-[#c4cfda] border-t-[#1666c4] rounded-full animate-spin" />
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
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-amber-800 text-xs leading-relaxed">
          Las credenciales de Payphone (Store ID, token) nunca se guardan en la base
          de datos ni pasan por el navegador. Se configuran como variables de entorno
          server-side en Convex (<code className="text-amber-900 font-semibold">PAYPHONE_STORE_ID</code>,{" "}
          <code className="text-amber-900 font-semibold">PAYPHONE_TOKEN</code>) vía{" "}
          <code className="text-amber-900 font-semibold">npx convex env set</code>. El cobro real no
          está implementado todavía — este panel solo prepara el terreno.
        </p>
      </div>

      <div className="bg-white border border-[#dde4ec] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-[#1666c4]" />
          <h3 className="text-[#102a43] text-sm font-semibold">Payphone</h3>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-[#627d98] text-xs">Credenciales configuradas</span>
          {settings.hasCredentials ? (
            <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5" /> Sí
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-600 text-xs font-mono">
              <ShieldOff className="w-3.5 h-3.5" /> No
            </span>
          )}
        </div>

        <div className="flex items-center justify-between py-2 border-t border-[#eef2f6]">
          <span className="text-[#627d98] text-xs">Habilitado</span>
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
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : "bg-white border-[#dde4ec] text-[#829ab1] hover:border-[#c4cfda]"
            }`}
          >
            {busy ? "…" : settings.payphoneEnabled ? "Habilitado" : "Deshabilitado"}
          </button>
        </div>
      </div>
    </div>
  );
}
