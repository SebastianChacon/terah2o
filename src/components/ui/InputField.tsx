import { InputHTMLAttributes } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function InputField({ label, className = "", ...props }: InputFieldProps) {
  return (
    <div>
      <label className="block text-[9px] font-black text-slate-400 uppercase mb-2 ml-1">
        {label}
      </label>
      <input
        className={`w-full p-4 rounded-xl font-bold border border-slate-200 bg-white text-slate-900 focus:border-navy-blue focus:outline-none focus:ring-4 focus:ring-navy-blue/[0.08] transition-all ${className}`}
        {...props}
      />
    </div>
  );
}
