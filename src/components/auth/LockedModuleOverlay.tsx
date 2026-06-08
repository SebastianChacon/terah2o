"use client";

import { Lock } from "lucide-react";

interface LockedModuleOverlayProps {
  moduleName: string;
  children: React.ReactNode;
  isLocked: boolean;
}

export function LockedModuleOverlay({
  moduleName,
  children,
  isLocked,
}: LockedModuleOverlayProps) {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="pointer-events-none select-none blur-[3px] opacity-35">
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05051a]/70 backdrop-blur-[2px] z-10">
        <div className="flex flex-col items-center gap-3 px-6 py-5 bg-white/4 border border-white/10 rounded-xl">
          <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-white font-semibold text-sm uppercase tracking-widest">
            Acceso Restringido
          </p>
          <p className="text-white/40 text-xs text-center max-w-55">
            No tienes permiso para acceder a{" "}
            <span className="text-white/60">{moduleName}</span>.
            Solicita acceso a tu administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
