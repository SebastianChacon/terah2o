"use client";

interface AiButtonProps {
  onClick: () => void;
  loading: boolean;
  label: string;
  loadingLabel?: string;
  variant?: "blue" | "amber";
}

const variantStyles = {
  blue: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-indigo-500/40",
  amber: "bg-gradient-to-r from-amber-500 to-orange-600 hover:shadow-orange-500/40",
};

export function AiButton({
  onClick,
  loading,
  label,
  loadingLabel = "Procesando...",
  variant = "blue",
}: AiButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-2 ${variantStyles[variant]} text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all active:scale-95 group disabled:opacity-70 ${
        loading ? "animate-pulse" : ""
      }`}
    >
      <span className={loading ? "animate-spin" : "group-hover:animate-spin"}>
        ✨
      </span>
      <span>{loading ? loadingLabel : label}</span>
    </button>
  );
}
