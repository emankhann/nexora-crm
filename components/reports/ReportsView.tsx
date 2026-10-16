"use client";

import { useState } from "react";
import { LEAD_SOURCES, OPEN_STAGES, useCrm } from "@/lib/crm-store";
import { canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import type { MonthRevenue } from "@/types";

const card = "rounded-2xl border border-line bg-white";
const ranges = [
  { value: 12, label: "Last 12 months" },
  { value: 6, label: "Last 6 months" },
  { value: 3, label: "Last 3 months" },
];

/**
 * Top of the Reports page. Past months come from the revenue history;
 * the current month, KPIs and lead sources are worked out live.
 */
export default function ReportsView({ history }: { history: MonthRevenue[] }) {
  const crm = useCrm();
  const user = useSessionUser();
  const [range, setRange] = useState(12);
  if (!crm || !user) return null;

  const leads = crm.leads.filter((l) => canSee(user, l.owner));
  const deals = crm.deals.filter((d) => canSee(user, d.owner));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const won = deals.filter((d) => d.stage === "Won");
  const wonThisMonth = won.filter((d) => d.closedAt && new Date(d.closedAt) >= monthStart).reduce((s, d) => s + d.value, 0);
  const lastMonth = history.at(-2)?.amount ?? 0;
  const change = lastMonth ? ((wonThisMonth - lastMonth) / lastMonth) * 100 : 0;
  const converted = leads.filter((l) => l.status === "Converted").length;
  const openDeals = deals.filter((d) => OPEN_STAGES.includes(d.stage));

  const kpis = [
    {
      label: "Revenue won this month",
      value: formatCurrency(wonThisMonth),
      note: lastMonth ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs last month` : "No data for last month",
    },
    { label: "Lead conversion", value: `${leads.length ? ((converted / leads.length) * 100).toFixed(1) : "0.0"}%`, note: `${converted} of ${leads.length} leads converted` },
    { label: "Average deal won", value: formatCurrency(won.length ? Math.round(won.reduce((s, d) => s + d.value, 0) / won.length) : 0), note: `Across ${won.length} won ${won.length === 1 ? "deal" : "deals"}` },
    { label: "Open pipeline", value: formatCurrency(openDeals.reduce((s, d) => s + d.value, 0)), note: `${openDeals.length} open deals` },
  ];

  const series: MonthRevenue[] = [
    ...history.slice(0, -1),
    { month: now.toLocaleDateString("en-US", { month: "short" }), amount: wonThisMonth },
  ];
  const months = series.slice(-range);
  const maxAmount = Math.max(1, ...months.map((m) => m.amount));
  const total = months.reduce((sum, m) => sum + m.amount, 0);

  const sources = LEAD_SOURCES.map((name) => {
    const count = leads.filter((l) => l.source === name).length;
    return { name, count, percent: leads.length ? Math.round((count / leads.length) * 100) : 0 };
  })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`${card} flex min-w-[160px] flex-1 flex-col gap-2 px-5 py-[18px]`}>
            <div className="text-[13px] text-slate-500">{kpi.label}</div>
            <div className="text-3xl font-extrabold tracking-tight">{kpi.value}</div>
            <div className="text-xs text-slate-500">{kpi.note}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className={`${card} flex min-w-0 flex-[999_1_420px] flex-col gap-4 px-4 py-[22px] sm:px-6`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Revenue won by month</h2>
              <div className="mt-0.5 text-xs text-slate-500">{formatCurrency(total)} in this period · this month updates live</div>
            </div>
            <label className="sr-only" htmlFor="range">
              Time range
            </label>
            <select
              id="range"
              value={range}
              onChange={(event) => setRange(Number(event.target.value))}
              className="h-[38px] rounded-[10px] border border-line bg-white px-2.5 text-[13px]"
            >
              {ranges.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {months.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No revenue recorded for this period.</div>
          ) : (
            <div className="flex items-end gap-1.5 sm:gap-3">
              {months.map((month, index) => (
                <div key={`${month.month}-${index}`} className="flex min-w-0 flex-1 flex-col gap-2">
                  <div
                    className={`w-full rounded-md ${index === months.length - 1 ? "bg-primary" : "bg-[#C9D0FB]"}`}
                    style={{ height: Math.max(4, Math.round((month.amount / maxAmount) * 200)) }}
                    title={`${month.month}: ${formatCurrency(month.amount)}`}
                  />
                  <div className="text-center text-[11.5px] text-slate-500">{month.month}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${card} flex min-w-0 flex-[1_1_300px] flex-col gap-4 px-4 py-[22px] sm:px-6`}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold">Leads by source</h2>
            <span className="text-xs text-slate-500">{leads.length} leads</span>
          </div>
          {sources.length === 0 && <div className="py-6 text-center text-sm text-slate-500">No leads yet.</div>}
          {sources.map((source) => (
            <div key={source.name} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px] font-semibold">
                <span>{source.name}</span>
                <span className="font-medium text-slate-700">
                  {source.count} · {source.percent}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#E9EDF8]">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${source.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
