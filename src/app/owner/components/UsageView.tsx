"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Activity, Building2 } from "lucide-react";
import type { UsageAnalytics } from "../types";

export function UsageView() {
  const usage = useQuery(api.superAdmin.getUsageAnalytics, {}) as
    | UsageAnalytics
    | undefined;
  const [orgFilter, setOrgFilter] = useState<string>("");

  const filtered = useMemo(() => {
    if (!usage) return null;
    if (!orgFilter) return usage;
    const org = usage.byOrg.find((o) => o.organizationId === orgFilter);
    return org
      ? { totalEvents: org.daily.reduce((a, d) => a + d.count, 0), daily: org.daily, monthly: org.monthly, byOrg: usage.byOrg }
      : usage;
  }, [usage, orgFilter]);

  if (usage === undefined || filtered === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  const last7 = filtered.daily.slice(-7);
  const maxCount = Math.max(1, ...last7.map((d) => d.count));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-white/25 text-xs font-mono flex-1">
          {filtered.totalEvents} sesiones registradas (total)
        </p>
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-white/30" />
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="px-2 py-1.5 bg-[#05051a] border border-white/10 rounded-lg text-white text-xs focus:border-amber-500/40 focus:outline-none"
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

      <div className="bg-[#0a1120] border border-white/7 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-amber-400/70" />
          <h3 className="text-white text-sm font-semibold">Últimos 7 días</h3>
        </div>
        <div className="flex items-end gap-2 h-32">
          {last7.length === 0 ? (
            <p className="text-white/25 text-xs">Sin datos todavía.</p>
          ) : (
            last7.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className="w-full bg-amber-500/30 border border-amber-500/40 rounded-t"
                  style={{ height: `${(d.count / maxCount) * 100}px` }}
                  title={`${d.count} sesiones`}
                />
                <span className="text-white/25 text-[0.55rem] font-mono">
                  {d.date.slice(5)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-[#0a1120] border border-white/7 rounded-xl p-4">
        <h3 className="text-white text-sm font-semibold mb-3">Por organización</h3>
        {usage.byOrg.length === 0 ? (
          <p className="text-white/25 text-xs">Sin datos todavía.</p>
        ) : (
          <div className="space-y-1.5">
            {usage.byOrg
              .map((o) => ({
                ...o,
                total: o.daily.reduce((a, d) => a + d.count, 0),
              }))
              .sort((a, b) => b.total - a.total)
              .map((o) => (
                <div
                  key={o.organizationId}
                  className="flex items-center justify-between text-xs text-white/50 py-1.5 border-b border-white/5 last:border-0"
                >
                  <span className="truncate">{o.orgName}</span>
                  <span className="text-white/70 font-mono">{o.total}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
