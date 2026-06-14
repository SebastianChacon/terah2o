interface ComplianceGaugeProps {
  percentage: number;
  size?: number;
}

export function ComplianceGauge({ percentage, size = 80 }: ComplianceGaugeProps) {
  const radius = (size / 2) - 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * percentage) / 100;

  const getLevel = () => {
    if (percentage >= 90) return { label: "NIVEL OPTIMO", color: "text-success-green" };
    if (percentage >= 70) return { label: "NIVEL ALERTA", color: "text-amber-500" };
    return { label: "NIVEL CRITICO", color: "text-danger-red" };
  };

  const level = getLevel();

  return (
    <div className="flex items-center gap-6">
      <div className="text-right">
        <div className="text-5xl font-black text-navy-blue leading-none tracking-tighter">
          {percentage}%
        </div>
        <div className={`text-[9px] font-black uppercase mt-1 ${level.color}`}>
          {level.label}
        </div>
      </div>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-slate-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-navy-blue transition-all duration-1000 ease-out"
          />
        </svg>
      </div>
    </div>
  );
}
