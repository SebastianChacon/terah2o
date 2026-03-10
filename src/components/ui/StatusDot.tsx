interface StatusDotProps {
  status: "ok" | "fail" | "neutral";
}

export function StatusDot({ status }: StatusDotProps) {
  const colors = {
    ok: "bg-success-green shadow-[0_0_10px_#10b981]",
    fail: "bg-danger-red shadow-[0_0_10px_#ef4444]",
    neutral: "bg-slate-200",
  };

  return (
    <div
      className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${colors[status]}`}
    />
  );
}
