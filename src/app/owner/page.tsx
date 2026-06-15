"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ShieldAlert } from "lucide-react";
import { OwnerShell } from "./components/OwnerShell";

export default function OwnerPanelPage() {
  const isOwner = useQuery(api.superAdmin.amISuperAdmin);

  if (isOwner === undefined) {
    return (
      <div className="min-h-screen bg-[#05051a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (isOwner === false) {
    return (
      <div className="min-h-screen bg-[#05051a] text-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <ShieldAlert className="w-12 h-12 text-red-400/70 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Acceso denegado</h1>
          <p className="text-white/40 text-sm">
            Esta área está reservada para el propietario del sistema.
          </p>
        </div>
      </div>
    );
  }

  return <OwnerShell />;
}
