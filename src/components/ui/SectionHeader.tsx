interface SectionHeaderProps {
  number: string;
  title: string;
  children?: React.ReactNode;
}

export function SectionHeader({ number, title, children }: SectionHeaderProps) {
  return (
    <div className="border-b border-slate-100 pb-6 mb-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-navy-blue rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-blue-900/20">
          {number}
        </div>
        <h3 className="text-navy-blue text-sm font-black uppercase tracking-widest">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
