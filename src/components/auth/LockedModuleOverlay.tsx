"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";

interface LockedModuleOverlayProps {
  moduleName: string;
  children: React.ReactNode;
  isLocked: boolean;
}

/**
 * Envuelve un módulo y aplica un overlay difuminado con candado
 * cuando isLocked=true. El contenido queda visible pero bloqueado.
 */
export function LockedModuleOverlay({
  moduleName,
  children,
  isLocked,
}: LockedModuleOverlayProps) {
  const router = useRouter();

  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Contenido difuminado */}
      <div className="pointer-events-none select-none blur-[3px] opacity-35">
        {children}
      </div>

      {/* Overlay de bloqueo */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05051a]/70 backdrop-blur-[2px] z-10">
        <div className="flex flex-col items-center gap-3 px-6 py-5 bg-white/[0.04] border border-white/10 rounded-xl">
          <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-white font-semibold text-sm uppercase tracking-widest">
            Módulo Restringido
          </p>
          <p className="text-white/40 text-xs text-center max-w-[200px]">
            {moduleName}
          </p>
          <button
            onClick={() => router.push("/pricing")}
            className="mt-1 px-5 py-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[0.68rem] font-bold uppercase tracking-[0.18em] rounded-[3px] hover:bg-blue-500/25 hover:border-blue-500/50 transition-all"
          >
            Ver Planes →
          </button>
        </div>
      </div>
    </div>
  );
}
