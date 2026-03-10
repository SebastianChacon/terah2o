interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "light" | "dark" | "glass";
  borderColor?: string;
}

export function Card({
  children,
  className = "",
  variant = "light",
  borderColor,
}: CardProps) {
  const baseStyles = {
    light:
      "bg-white border border-slate-200 card-shadow",
    dark:
      "bg-navy-light border-l-4 border-blue-500",
    glass: "glass-panel",
  };

  const borderStyle = borderColor
    ? { borderLeftColor: borderColor, borderLeftWidth: "4px" }
    : undefined;

  return (
    <div
      className={`rounded-[2.5rem] p-10 ${baseStyles[variant]} ${className}`}
      style={borderStyle}
    >
      {children}
    </div>
  );
}
