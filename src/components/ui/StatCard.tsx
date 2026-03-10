interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  variant?: "navy" | "cyan" | "orange" | "green";
}

const variantStyles = {
  navy: "border-l-navy-blue",
  cyan: "border-l-accent-cyan",
  orange: "border-l-amber",
  green: "border-l-success-green",
};

const variantLabel = {
  navy: "text-navy-blue",
  cyan: "text-accent-cyan",
  orange: "text-amber-400",
  green: "text-success-green",
};

export function StatCard({
  label,
  value,
  sublabel,
  variant = "navy",
}: StatCardProps) {
  return (
    <div
      className={`bg-navy-light border-l-4 ${variantStyles[variant]} p-6 rounded-lg text-center shadow-xl`}
    >
      <span
        className={`text-[10px] uppercase font-bold tracking-widest ${variantLabel[variant]}`}
      >
        {label}
      </span>
      <div className="text-3xl font-bold text-white mt-1">{value}</div>
      {sublabel && (
        <div className="text-[10px] text-gray-500 mt-1 uppercase font-bold">
          {sublabel}
        </div>
      )}
    </div>
  );
}
