"use client";

import { useState } from "react";
import { NavbarUser } from "@/components/auth/NavbarUser";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import {
  Crown,
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  UserPlus,
  Layers,
  Activity,
  Wallet,
} from "lucide-react";
import type { OwnerView } from "../types";
import { DashboardView } from "./DashboardView";
import { OrganizationsView } from "./OrganizationsView";
import { AccountsView } from "./AccountsView";
import { SubscriptionsView } from "./SubscriptionsView";
import { CreateClientModal } from "./CreateClientModal";
import { PlansView } from "./PlansView";
import { UsageView } from "./UsageView";
import { PaymentsView } from "./PaymentsView";

const NAV: { key: OwnerView; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Resumen", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "organizations", label: "Organizaciones", icon: <Building2 className="w-4 h-4" /> },
  { key: "accounts", label: "Cuentas", icon: <Users className="w-4 h-4" /> },
  { key: "subscriptions", label: "Suscripciones", icon: <CreditCard className="w-4 h-4" /> },
  { key: "plans", label: "Planes", icon: <Layers className="w-4 h-4" /> },
  { key: "usage", label: "Uso del sistema", icon: <Activity className="w-4 h-4" /> },
  { key: "payments", label: "Pagos", icon: <Wallet className="w-4 h-4" /> },
];

const VIEW_TITLE: Record<OwnerView, string> = {
  dashboard: "Resumen ejecutivo",
  organizations: "Organizaciones",
  accounts: "Control de cuentas",
  subscriptions: "Suscripciones",
  plans: "Planes comerciales",
  usage: "Uso del sistema",
  payments: "Pagos",
};

export function OwnerShell() {
  const [view, setView] = useState<OwnerView>("dashboard");
  const [createOpen, setCreateOpen] = useState(false);
  const { toast, showToast } = useToast();

  return (
    <div className="min-h-screen bg-[#05051a] text-white">
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      {createOpen && (
        <CreateClientModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => setCreateOpen(false)}
          showToast={showToast}
        />
      )}

      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,158,11,0.06)_0%,transparent_60%)]" />

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-white/[0.06] px-4 py-6">
          <div className="flex items-center gap-2 text-amber-400/90 mb-8 px-2">
            <Crown className="w-5 h-5" />
            <span className="text-sm font-mono uppercase tracking-widest">
              Panel Owner
            </span>
          </div>
          <nav className="space-y-1 flex-1">
            {NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  view === item.key
                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    : "text-white/45 hover:text-white/80 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm font-semibold hover:bg-amber-500/25 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo cliente
          </button>
        </aside>

        {/* Contenido */}
        <main className="flex-1 min-w-0">
          {/* Topbar */}
          <header className="flex items-center justify-between px-5 sm:px-8 py-5 border-b border-white/[0.06]">
            <div>
              <h1 className="text-xl font-bold text-white">{VIEW_TITLE[view]}</h1>
              <p className="text-white/30 text-xs">Control global del sistema</p>
            </div>
            <NavbarUser />
          </header>

          {/* Tabs móviles */}
          <div className="md:hidden flex gap-1.5 overflow-x-auto px-5 py-3 border-b border-white/[0.06]">
            {NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  view === item.key
                    ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    : "text-white/40 border border-transparent"
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
              />
            )}
            {view === "organizations" && (
              <OrganizationsView showToast={showToast} />
            )}
            {view === "accounts" && <AccountsView showToast={showToast} />}
            {view === "subscriptions" && (
              <SubscriptionsView showToast={showToast} />
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
