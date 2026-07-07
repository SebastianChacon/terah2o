"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Search, Download, UserPlus, ChevronUp, ChevronDown } from "lucide-react";
import type { AccountRow, OrgRow } from "../types";
import { clientStatus, daysLeft, formatDate } from "../types";
import { cardClass, secondaryBtnClass, primaryBtnClass } from "./shared";
import { ClientDetail } from "./ClientDetail";

type StatusFilter = "all" | "active" | "expiring" | "trial" | "expired" | "none";
type SortKey = "company" | "plan" | "status" | "expiry";

function exportClientsCSV(orgs: OrgRow[]) {
  const headers = [
    "Empresa",
    "Dueño",
    "Correo",
    "Estado",
    "Plan",
    "Admins",
    "Operadores",
    "Tipo de contrato",
    "N° contrato",
    "Caudal (L/s)",
    "Creada",
  ];
  const rows = orgs.map((o) => {
    const st = clientStatus(o.subscription);
    return [
      o.name,
      o.ownerName ?? "",
      o.ownerEmail ?? "",
      st.label,
      o.subscription?.plan ?? "",
      String(o.adminCount),
      String(o.operatorCount),
      o.contractType ?? "",
      o.contractNumber ?? "",
      o.plantProfile ? String(o.plantProfile.caudalLs) : "",
      formatDate(o.createdAt),
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `terah2o-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ClientsViewProps {
  showToast: (msg: string, type: "success" | "error") => void;
  onCreateClient: () => void;
}

export function ClientsView({ showToast, onCreateClient }: ClientsViewProps) {
  const orgs = useQuery(api.superAdmin.listOrganizations) as OrgRow[] | undefined;
  const accounts = useQuery(api.superAdmin.listAllUsers) as AccountRow[] | undefined;

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("expiry");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const membersByOrg = useMemo(() => {
    const map = new Map<string, AccountRow[]>();
    for (const a of accounts ?? []) {
      if (!a.organizationId) continue;
      const arr = map.get(a.organizationId) ?? [];
      arr.push(a);
      map.set(a.organizationId, arr);
    }
    return map;
  }, [accounts]);

  const rows = useMemo(() => {
    if (!orgs) return [];
    const q = search.trim().toLowerCase();
    const filtered = orgs.filter((o) => {
      const st = clientStatus(o.subscription);
      if (statusFilter !== "all" && st.key !== statusFilter) return false;
      if (!q) return true;
      const hay = `${o.name} ${o.ownerName ?? ""} ${o.ownerEmail ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    const sortVal = (o: OrgRow): string | number => {
      if (sortKey === "company") return o.name.toLowerCase();
      if (sortKey === "plan") return o.subscription?.plan ?? "";
      if (sortKey === "status") return clientStatus(o.subscription).key;
      const d = daysLeft(o.subscription?.status === "trialing" ? o.subscription?.trialEndsAt : o.subscription?.expiresAt);
      return d ?? Number.MAX_SAFE_INTEGER;
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.slice().sort((a, b) => {
      const va = sortVal(a);
      const vb = sortVal(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [orgs, search, statusFilter, sortKey, sortDir]);

  if (orgs === undefined || accounts === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#c4cfda] border-t-[#1666c4] rounded-full animate-spin" />
      </div>
    );
  }

  const selectedOrg = selectedOrgId ? orgs.find((o) => o._id === selectedOrgId) : undefined;
  if (selectedOrg) {
    return (
      <ClientDetail
        org={selectedOrg}
        members={membersByOrg.get(selectedOrg._id) ?? []}
        showToast={showToast}
        onBack={() => setSelectedOrgId(null)}
      />
    );
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (
      sortDir === "asc" ? (
        <ChevronUp className="w-3 h-3 inline" />
      ) : (
        <ChevronDown className="w-3 h-3 inline" />
      )
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[#627d98] text-sm">
          {rows.length} de {orgs.length} clientes
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => exportClientsCSV(orgs)}
            disabled={orgs.length === 0}
            className={`${secondaryBtnClass} flex items-center gap-1.5`}
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
          <button onClick={onCreateClient} className={`${primaryBtnClass} flex items-center gap-1.5`}>
            <UserPlus className="w-3.5 h-3.5" />
            Nuevo cliente
          </button>
        </div>
      </div>

      <div className="flex gap-2.5 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#829ab1]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa, dueño o correo…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#c4cfda] rounded-lg text-[#102a43] text-sm placeholder:text-[#829ab1] focus:border-[#1666c4] focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2.5 bg-white border border-[#c4cfda] rounded-lg text-sm text-[#334e68] focus:border-[#1666c4] focus:outline-none"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="expiring">Por vencer</option>
          <option value="trial">En prueba</option>
          <option value="expired">Vencida</option>
          <option value="none">Sin plan</option>
        </select>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr_90px] gap-3 px-5 py-3 bg-[#f7f9fb] border-b border-[#dde4ec] text-[0.68rem] font-semibold uppercase tracking-wide text-[#829ab1]">
          <button onClick={() => toggleSort("company")} className="text-left">
            Empresa / dueño {sortIcon("company")}
          </button>
          <button onClick={() => toggleSort("plan")} className="text-left">
            Plan {sortIcon("plan")}
          </button>
          <button onClick={() => toggleSort("status")} className="text-left">
            Estado {sortIcon("status")}
          </button>
          <button onClick={() => toggleSort("expiry")} className="text-left">
            Vence {sortIcon("expiry")}
          </button>
          <div />
        </div>

        {rows.map((o) => {
          const st = clientStatus(o.subscription);
          const expiry = formatDate(
            o.subscription?.status === "trialing" ? o.subscription?.trialEndsAt : o.subscription?.expiresAt
          );
          return (
            <div
              key={o._id}
              className="grid grid-cols-[2.4fr_1fr_1fr_1fr_90px] gap-3 px-5 py-3.5 border-b border-[#f3f6f9] last:border-0 items-center"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm text-[#102a43] truncate">{o.name}</div>
                <div className="text-xs text-[#829ab1] truncate">
                  {o.ownerName ?? o.ownerEmail ?? "—"}
                </div>
              </div>
              <div className="text-sm text-[#334e68] capitalize">
                {o.subscription?.plan ?? "—"}
              </div>
              <div>
                <span className={`text-[0.7rem] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${st.className}`}>
                  {st.label}
                </span>
              </div>
              <div className="font-mono text-xs text-[#486581]">{expiry}</div>
              <div>
                <button
                  onClick={() => setSelectedOrgId(o._id)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#1666c4] text-white text-xs font-semibold hover:bg-[#0f4c91] transition-colors"
                >
                  Gestionar
                </button>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="py-16 text-center text-sm text-[#829ab1]">
            No hay clientes que coincidan con la búsqueda o los filtros.
          </div>
        )}
      </div>
    </div>
  );
}
