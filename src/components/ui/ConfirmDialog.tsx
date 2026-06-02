"use client";

import { X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmClasses =
    variant === "danger"
      ? "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
      : "bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#05051a]/80 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md bg-[#0a1120] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h3 id="confirm-dialog-title" className="text-white font-semibold text-sm">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors rounded disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-white/50 text-sm leading-relaxed mb-6">{message}</p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-white/40 text-[0.68rem] font-mono uppercase tracking-widest hover:text-white/60 disabled:opacity-40 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 border text-[0.68rem] font-bold uppercase tracking-widest rounded-lg disabled:opacity-50 transition-all ${confirmClasses}`}
            >
              {loading ? "Procesando..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
