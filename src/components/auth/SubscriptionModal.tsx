"use client";

import { X, Zap, Shield, Star } from "lucide-react";
import { useRouter } from "next/navigation";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

/**
 * Modal de upgrade de suscripcion.
 * Se muestra cuando un usuario intenta acceder a una funcionalidad premium.
 */
export function SubscriptionModal({ isOpen, onClose, reason }: SubscriptionModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#05051a]/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#0a1120] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center font-bold text-white text-xs">
              T
            </div>
            <span className="font-bold text-white text-sm tracking-wide">
              Actualizar Plan
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {reason && (
            <p className="text-white/50 text-xs mb-5 font-mono tracking-wide border-l-2 border-blue-500/30 pl-3">
              {reason}
            </p>
          )}

          <h3 className="text-white font-bold text-lg mb-2">
            Accede a todas las funcionalidades
          </h3>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            Desbloquea el control total de tu planta de tratamiento con un plan activo.
          </p>

          {/* Features */}
          <div className="space-y-3 mb-6">
            {[
              { icon: Zap, text: "Consola Tecnica y Hoja Operativa" },
              { icon: Shield, text: "Stock & Kardex + Finanzas PTAP" },
              { icon: Star, text: "Academia y Bitacora Maestra" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-white/60 text-sm">{text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => { onClose(); router.push("/pricing"); }}
            className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm uppercase tracking-[0.15em] rounded-lg transition-all shadow-lg shadow-blue-500/20"
          >
            Ver Planes y Precios
          </button>
          <button
            onClick={onClose}
            className="w-full mt-2 py-2.5 text-white/30 hover:text-white/50 text-xs font-mono uppercase tracking-widest transition-colors"
          >
            Continuar sin actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
