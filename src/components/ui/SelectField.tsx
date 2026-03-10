import { SelectHTMLAttributes } from "react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export function SelectField({
  label,
  options,
  className = "",
  ...props
}: SelectFieldProps) {
  return (
    <div>
      <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">
        {label}
      </label>
      <select
        className={`w-full p-4 rounded-xl font-bold border border-slate-200 bg-white text-slate-900 focus:border-navy-blue focus:outline-none transition-all ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
