"use client";

interface ToastProps {
  message: string;
  type: "info" | "error" | "success";
  visible: boolean;
}

const typeStyles = {
  info: "bg-navy-blue text-white border-white/20",
  error: "bg-danger-red text-white border-red-400/30",
  success: "bg-success-green text-white border-green-400/30",
};

export function Toast({ message, type, visible }: ToastProps) {
  return (
    <div
      className={`fixed bottom-32 right-6 z-[1000] px-8 py-4 rounded-2xl shadow-2xl border text-xs font-black uppercase tracking-widest transition-all duration-300 ${
        typeStyles[type]
      } ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
    >
      {message}
    </div>
  );
}
