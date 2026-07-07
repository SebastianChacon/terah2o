"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Activity, Building2 } from "lucide-react";
import type { UsageAnalytics } from "../types";
import { cardClass } from "./shared";

type Period = "day" | "month";

export function UsageView() {
  const usage = useQuery(api.superAdmin.getUsageAnalytics, {}) as UsageAnalytics | undefined;
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [period, setPeriod] = useState<Period>("day");

  // Serie usada para el gráfico de barras: respeta el filtro de organización.
  const series = useMemo(() => {
    if (!usage) return [];
    const source = orgFilter
      ? usage.byOrg.find((o) => o.organizationId === orgFilter)
      : { daily: usage.daily, monthly: usage.monthly };
    if (!source) return [];
    const arr = period === "day" ? source.daily : source.monthly;
    return period === "day" ? arr.slice(-14) : arr.slice(-6);
  }, [usage, orgFilter, period]);

  if (usage === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[#c4cfda] border-t-[#1666c4] rounded-full animate-spin" />
      </div>
    );
  }

  const maxCount = Math.max(1, ...series.map((d) => d.count));
  const bucketKey = (d: (typeof series)[number]) => ("date" in d ? d.date : d.ym);
  const totalPeriod = series.reduce((a, x) => a + x.count, 0);

  // Tabla "por organización": siempre respeta el filtro elegido arriba.
  const orgRows = (orgFilter ? usage.byOrg.filter((o) => o.organizationId === orgFilter) : usage.byOrg)
    .map((o) => ({
      ...o,
      total: (period === "day" ? o.daily : o.monthly).reduce((a, d) => a + d.count, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-[#627d98] text-sm flex-1">
          {usage.totalEvents} sesiones registradas (total)
        </p>
        <div className="flex bg-[#eef2f6] rounded-lg p-0.5">
          {(["day", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                period === p ? "bg-white text-[#0f4c91] shadow-sm" : "text-[#627d98]"
              }`}
            >
              {p === "day" ? "Por día" : "Por mes"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-[#829ab1]" />
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="px-2 py-1.5 bg-white border border-[#c4cfda] rounded-lg text-[#334e68] text-xs focus:border-[#1666c4] focus:outline-none"
          >
            <option value="">Todas las orgs</option>
            {usage.byOrg.map((o) => (
              <option key={o.organizationId} value={o.organizationId}>
                {o.orgName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`${cardClass} p-4`}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#1666c4]" />
          <h3 className="text-[#102a43] text-sm font-semibold">
            {period === "day" ? "Últimos 14 días" : "Últimos 6 meses"} · {totalPeriod} ingresos
          </h3>
        </div>
        <div className="flex items-end gap-2 h-32">
          {series.length === 0 ? (
            <p className="text-[#829ab1] text-xs">Sin datos todavía.</p>
          ) : (
            series.map((d) => (
              <div key={bucketKey(d)} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className="w-full bg-gradient-to-b from-[#3b86d8] to-[#1666c4] rounded-t"
                  style={{ height: `${Math.max(4, (d.count / maxCount) * 100)}px` }}
                  title={`${d.count} sesiones`}
                />
                <span className="text-[#829ab1] text-[0.6rem] font-mono">
                  {period === "day" ? bucketKey(d).slice(5) : bucketKey(d).slice(5)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`${cardClass} p-4`}>
        <h3 className="text-[#102a43] text-sm font-semibold mb-3">Por organización</h3>
        {orgRows.length === 0 ? (
          <p className="text-[#829ab1] text-xs">Sin datos todavía.</p>
        ) : (
          <div className="space-y-1.5">
            {orgRows.map((o) => (
              <div
                key={o.organizationId}
                className="flex items-center justify-between text-xs text-[#486581] py-1.5 border-b border-[#f3f6f9] last:border-0"
              >
                <span className="truncate">{o.orgName}</span>
                <span className="text-[#102a43] font-mono font-semibold">{o.total}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
