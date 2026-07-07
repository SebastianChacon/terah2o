"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import {
  Crown,
  LayoutDashboard,
  Building2,
  Layers,
  Activity,
  Wallet,
  UserPlus,
  Eye,
  EyeOff,
} from "lucide-react";
import type { OwnerMetrics, OwnerView } from "../types";
import { DashboardView } from "./DashboardView";
import { ClientsView } from "./ClientsView";
import { CreateClientModal } from "./CreateClientModal";
import { PlansView } from "./PlansView";
import { UsageView } from "./UsageView";
import { PaymentsView } from "./PaymentsView";

const NAV: { key: OwnerView; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Resumen", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "clients", label: "Clientes", icon: <Building2 className="w-4 h-4" /> },
  { key: "plans", label: "Planes", icon: <Layers className="w-4 h-4" /> },
  { key: "usage", label: "Uso del sistema", icon: <Activity className="w-4 h-4" /> },
  { key: "payments", label: "Pagos", icon: <Wallet className="w-4 h-4" /> },
];

const VIEW_TITLE: Record<OwnerView, string> = {
  dashboard: "Resumen ejecutivo",
  clients: "Clientes y suscripciones",
  plans: "Configuración de planes",
  usage: "Uso del sistema",
  payments: "Pagos",
};

export function OwnerShell() {
  const [view, setView] = useState<OwnerView>("dashboard");
  const [createOpen, setCreateOpen] = useState(false);
  const [revHidden, setRevHidden] = useState(false);
  const { toast, showToast } = useToast();
  const metrics = useQuery(api.superAdmin.getOwnerDashboard) as OwnerMetrics | undefined;

  return (
    <div className="min-h-screen bg-[#eef2f6] text-[#102a43]">
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      {createOpen && (
        <CreateClientModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => setCreateOpen(false)}
          showToast={showToast}
        />
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-[#dde4ec] px-4 py-6">
          <div className="flex items-center gap-2 text-[#1666c4] mb-8 px-2">
            <Crown className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-widest">Panel Owner</span>
          </div>
          <nav className="space-y-1 flex-1">
            {NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  view === item.key
                    ? "bg-[#e8f1fc] text-[#0f4c91]"
                    : "text-[#627d98] hover:bg-[#f7f9fb] hover:text-[#334e68]"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#1666c4] text-white text-sm font-semibold hover:bg-[#0f4c91] transition-all mb-4"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo cliente
          </button>

          <div className="border-t border-[#eef2f6] pt-4 px-1">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[#829ab1] text-xs">Ingresos recurrentes (MRR)</span>
              <button
                onClick={() => setRevHidden((h) => !h)}
                title={revHidden ? "Mostrar ingresos" : "Modo presentación (ocultar ingresos)"}
                className={`w-6.5 h-6.5 flex items-center justify-center rounded-lg border transition-colors ${
                  revHidden ? "border-[#1666c4] bg-[#e8f1fc] text-[#0f4c91]" : "border-[#dde4ec] text-[#627d98]"
                }`}
              >
                {revHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="font-mono text-2xl font-semibold text-[#0f4c91]">
              {revHidden || metrics === undefined ? "•••••" : `$${metrics.mrr.toLocaleString("en-US")}`}
            </div>
            <div className="text-xs text-emerald-600 mt-0.5">
              {metrics ? `${metrics.subsByStatus.active} suscripciones activas` : "…"}
            </div>
          </div>
        </aside>

        {/* Contenido */}
        <main className="flex-1 min-w-0">
          <header className="flex items-center justify-between px-5 sm:px-8 py-5 bg-white border-b border-[#dde4ec]">
            <div>
              <h1 className="text-xl font-bold text-[#102a43]">{VIEW_TITLE[view]}</h1>
              <p className="text-[#829ab1] text-xs">Control global del sistema</p>
            </div>
            <NavbarUser />
          </header>

          <div className="md:hidden flex gap-1.5 overflow-x-auto px-5 py-3 bg-white border-b border-[#dde4ec]">
            {NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  view === item.key ? "bg-[#e8f1fc] text-[#0f4c91]" : "text-[#627d98]"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          <div className="px-5 sm:px-8 py-6 max-w-5xl">
            {view === "dashboard" && (
              <DashboardView
                onNavigate={setView}
                onCreateClient={() => setCreateOpen(true)}
                revHidden={revHidden}
              />
            )}
            {view === "clients" && (
              <ClientsView showToast={showToast} onCreateClient={() => setCreateOpen(true)} />
            )}
            {view === "plans" && <PlansView showToast={showToast} />}
            {view === "usage" && <UsageView />}
            {view === "payments" && <PaymentsView showToast={showToast} />}
          </div>
        </main>
      </div>
    </div>
  );
}
