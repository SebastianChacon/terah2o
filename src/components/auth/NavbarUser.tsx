"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSubscription } from "@/hooks/useSubscription";
import { getStatusColor, getPlanLabel } from "@/types/auth";
import { User, ChevronDown, LogOut, Settings, LayoutDashboard } from "lucide-react";
import { useState, useRef, useEffect } from "react";

/**
 * Widget de perfil de usuario para el navbar.
 * - Sin sesion: muestra enlace "Ingresar →"
 * - Con sesion: chip con nombre, dot de estado y badge de plan
 * - Dropdown: perfil, panel admin (solo admins), cerrar sesion
 */
export function NavbarUser() {
  const { user, isLoading } = useCurrentUser();
  const { subscription } = useSubscription();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Esqueleto mientras carga
  if (isLoading) {
    return <div className="w-32 h-8 bg-white/5 rounded animate-pulse" />;
  }

  // No autenticado
  if (!user) {
    return (
      <Link
        href="/login"
        className="font-mono text-[0.68rem] tracking-[0.15em] uppercase text-white/40 hover:text-blue-400 transition-colors"
      >
        Ingresar →
      </Link>
    );
  }

  const statusColor = getStatusColor(subscription?.status);
  const planLabel = getPlanLabel(subscription?.plan, subscription?.status);
  const displayName = user.name ?? user.email.split("@")[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Chip */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/[0.08] rounded-[3px] hover:border-blue-500/40 hover:bg-white/[0.07] transition-all group"
        aria-label="Menu de usuario"
      >
        {/* Avatar */}
        <div className="w-5 h-5 bg-blue-500/20 rounded flex items-center justify-center text-blue-400 flex-shrink-0">
          <User className="w-3 h-3" />
        </div>

        {/* Nombre */}
        <span className="font-mono text-[0.65rem] text-white/60 tracking-wide max-w-[90px] truncate group-hover:text-white/80 transition-colors">
          {displayName}
        </span>

        {/* Dot de estado */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusColor}`} />

        {/* Badge de plan */}
        <span className="font-mono text-[0.58rem] text-blue-400/70 tracking-[0.12em] flex-shrink-0">
          {planLabel}
        </span>

        <ChevronDown
          className={`w-3 h-3 text-white/20 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#080f1e] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 py-1.5 overflow-hidden">
          {/* Info header */}
          <div className="px-4 py-2.5 border-b border-white/[0.06]">
            <p className="text-white/80 text-xs font-semibold truncate">{user.email}</p>
            <p className="text-white/30 text-[0.65rem] font-mono uppercase tracking-widest mt-0.5">
              {user.role === "admin" ? "Administrador" : "Operador"}
            </p>
          </div>

          {/* Links */}
          <div className="py-1">
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[0.72rem] text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Mi Perfil
            </Link>

            {user.role === "admin" && (
              <Link
                href="/dashboard/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-[0.72rem] text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Panel Admin
              </Link>
            )}
          </div>

          <hr className="border-white/[0.06] mx-2" />

          {/* Cerrar sesion */}
          <div className="py-1">
            <button
              onClick={async () => {
                setOpen(false);
                // Limpiar cookie de suscripcion antes de salir
                const secure = location.protocol === "https:" ? "; Secure" : "";
                document.cookie = `__convexSubStatus=; path=/; max-age=0; SameSite=Lax${secure}`;
                try {
                  await signOut();
                } catch {
                  // Clerk limpia su cookie automaticamente; proceder igual
                }
                window.location.href = "/login";
              }}
              className="flex items-center gap-2.5 px-4 py-2 w-full text-[0.72rem] text-red-400/50 hover:text-red-400 hover:bg-white/[0.04] transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar Sesion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
