import Link from "next/link";

interface GlassPanelProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  iconColor?: string;
  iconBg?: string;
  iconHoverBg?: string;
}

export function GlassPanel({
  href,
  icon,
  title,
  description,
  iconColor = "text-sky-400",
  iconBg = "bg-sky-500/10",
  iconHoverBg = "group-hover:bg-sky-500",
}: GlassPanelProps) {
  return (
    <Link href={href} className="glass-panel p-6 text-left group cursor-pointer block">
      <div
        className={`w-10 h-10 ${iconBg} ${iconColor} rounded-lg flex items-center justify-center mb-4 ${iconHoverBg} group-hover:text-white transition-all`}
      >
        {icon}
      </div>
      <h3 className="text-white font-bold text-sm mb-1">{title}</h3>
      <p className="text-slate-500 text-[10px] font-medium leading-relaxed">
        {description}
      </p>
    </Link>
  );
}
