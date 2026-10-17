"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { DEAL_STAGES, LEAD_SOURCES, OPEN_STAGES, useCrm } from "@/lib/crm-store";
import { downloadCsv } from "@/lib/csv";
import { can, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnOutline, card, selectCls } from "@/lib/ui";
import { getUsers } from "@/lib/users";
import { daysBetween, formatCurrency, formatDate } from "@/lib/utils";
import type { DealStage } from "@/types";

type Tab = "pipeline" | "conversion" | "team";
const PERIODS = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 12 months" },
  { value: 0, label: "All time" },
];
const stageBar: Partial<Record<DealStage, string>> = { Won: "bg-primary", Lost: "bg-slate-400" };

/** Reports worked out live from the CRM data, with basic filters. */
export default function LiveReports() {
  const crm = useCrm();
  const user = useSessionUser();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [period, setPeriod] = useState(90);
  const [owner, setOwner] = useState("Whole team");

  const data = useMemo(() => {
    if (!crm || !user) return null;
    const inPeriod = (iso: string | null) => period === 0 || (iso !== null && daysBetween(iso) <= period);
    const mine = (o: string) => canSee(user, o) && (owner === "Whole team" || o === owner);

    const deals = crm.deals.filter((d) => mine(d.owner));
    // Open deals always count; closed deals count when they closed inside the period.
    const scoped = deals.filter((d) => OPEN_STAGES.includes(d.stage) || inPeriod(d.closedAt));
    const open = scoped.filter((d) => OPEN_STAGES.includes(d.stage));
    const won = scoped.filter((d) => d.stage === "Won");
    const lost = scoped.filter((d) => d.stage === "Lost");
    const stages = DEAL_STAGES.map((stage) => {
      const list = scoped.filter((d) => d.stage === stage);
      const value = list.reduce((s, d) => s + d.value, 0);
      return {
        stage,
        count: list.length,
        value,
        weighted: list.reduce((s, d) => s + (d.value * d.probability) / 100, 0),
        avgProb: list.length ? Math.round(list.reduce((s, d) => s + d.probability, 0) / list.length) : 0,
        overdue: OPEN_STAGES.includes(stage) ? list.filter((d) => daysBetween(d.closeDate) > 0).length : 0,
      };
    });
    const lostReasons = Object.entries(
      lost.reduce<Record<string, number>>((acc, d) => {
        const r = d.lostReason || "Not given";
        acc[r] = (acc[r] ?? 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);
    const closingSoon = open.filter((d) => daysBetween(d.closeDate) <= 0 && daysBetween(d.closeDate) >= -21).sort((a, b) => a.closeDate.localeCompare(b.closeDate)).slice(0, 5);

    const leads = crm.leads.filter((l) => mine(l.owner) && inPeriod(l.createdAt));
    const converted = leads.filter((l) => l.status === "Converted");
    const funnel = [
      { name: "All leads", count: leads.length },
      { name: "Contacted or later", count: leads.filter((l) => ["Contacted", "Qualified", "Converted"].includes(l.status)).length },
      { name: "Qualified or later", count: leads.filter((l) => ["Qualified", "Converted"].includes(l.status)).length },
      { name: "Converted", count: converted.length },
    ];
    const bySource = LEAD_SOURCES.map((src) => {
      const list = leads.filter((l) => l.source === src);
      const conv = list.filter((l) => l.status === "Converted").length;
      return { src, count: list.length, conv, rate: list.length ? Math.round((conv / list.length) * 100) : 0 };
    }).filter((r) => r.count > 0);

    const team = getUsers()
      .filter((u) => canSee(user, u.short) && (owner === "Whole team" || u.short === owner))
      .map((u) => {
        const uLeads = crm.leads.filter((l) => l.owner === u.short && inPeriod(l.createdAt));
        const uWon = crm.deals.filter((d) => d.owner === u.short && d.stage === "Won" && inPeriod(d.closedAt));
        const uLost = crm.deals.filter((d) => d.owner === u.short && d.stage === "Lost" && inPeriod(d.closedAt));
        return {
          name: u.short,
          role: u.role,
          leads: uLeads.length,
          converted: uLeads.filter((l) => l.status === "Converted").length,
          won: uWon.length,
          revenue: uWon.reduce((s, d) => s + d.value, 0),
          winRate: uWon.length + uLost.length ? Math.round((uWon.length / (uWon.length + uLost.length)) * 100) : null,
          pipeline: crm.deals.filter((d) => d.owner === u.short && OPEN_STAGES.includes(d.stage)).reduce((s, d) => s + d.value, 0),
          tasksDone: crm.tasks.filter((t) => t.owner === u.short && t.done && t.doneAt && inPeriod(t.doneAt)).length,
        };
      });

    return {
      stages,
      open,
      won,
      lost,
      lostReasons,
      closingSoon,
      openValue: open.reduce((s, d) => s + d.value, 0),
      weighted: open.reduce((s, d) => s + (d.value * d.probability) / 100, 0),
      winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
      avgWon: won.length ? Math.round(won.reduce((s, d) => s + d.value, 0) / won.length) : 0,
      leads,
      converted,
      funnel,
      bySource,
      team,
    };
  }, [crm, user, period, owner]);

  if (!data || !user) return null;
  const maxStage = Math.max(1, ...data.stages.map((s) => s.value));
  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));

  function exportCsv() {
    if (!data) return;
    if (tab === "pipeline")
      downloadCsv("nexora-pipeline-summary.csv", ["Stage", "Deals", "Value", "Weighted value", "Avg probability", "Overdue"], data.stages.map((s) => [s.stage, s.count, s.value, Math.round(s.weighted), `${s.avgProb}%`, s.overdue]));
    else if (tab === "conversion")
      downloadCsv("nexora-lead-conversion.csv", ["Source", "Leads", "Converted", "Conversion rate"], data.bySource.map((r) => [r.src, r.count, r.conv, `${r.rate}%`]));
    else
      downloadCsv(
        "nexora-team-performance.csv",
        ["Rep", "Role", "New leads", "Converted", "Deals won", "Revenue won", "Win rate", "Open pipeline", "Tasks done"],
        data.team.map((t) => [t.name, t.role, t.leads, t.converted, t.won, t.revenue, t.winRate === null ? "" : `${t.winRate}%`, t.pipeline, t.tasksDone])
      );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "pipeline", label: "Pipeline summary" },
    { key: "conversion", label: "Lead conversion" },
    { key: "team", label: "Team performance" },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div role="tablist" className="-mx-1 flex gap-1.5 overflow-x-auto border-b border-line px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[13.5px] font-bold ${tab === t.key ? "border-primary text-primary" : "border-transparent text-slate-600 hover:text-navy"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-slate-500">
          Period
          <select className={selectCls} value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {can(user, "viewAll") && (
          <label className="flex items-center gap-2 text-[13px] text-slate-500">
            Owner
            <select className={selectCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
              {["Whole team", ...getUsers().map((u) => u.short)].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        )}
        {can(user, "export") && (
          <button type="button" className={`${btnOutline} ml-auto`} onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </button>
        )}
      </div>

      {tab === "pipeline" && (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {[
              ["Open pipeline", formatCurrency(data.openValue), `${data.open.length} deals`],
              ["Weighted forecast", formatCurrency(Math.round(data.weighted)), "value × probability"],
              ["Win rate", data.winRate === null ? "–" : `${data.winRate}%`, `${data.won.length} won · ${data.lost.length} lost`],
              ["Average deal won", formatCurrency(data.avgWon), "In this period"],
            ].map(([k, v, note]) => (
              <div key={k} className={`${card} px-[18px] py-4`}>
                <div className="text-[12.5px] text-slate-500">{k}</div>
                <b className="text-2xl">{v}</b>
                <div className="text-xs text-slate-500">{note}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <div className={`${card} min-w-0 flex-[999_1_560px] px-4 py-5 sm:px-[22px]`}>
              <h2 className="mb-3 text-base font-extrabold">Deals by stage</h2>
              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="grid grid-cols-[1.1fr_.6fr_2.4fr_1fr_.9fr] gap-3.5 pb-2 text-xs font-semibold text-slate-500">
                    <span>Stage</span>
                    <span>Deals</span>
                    <span>Value</span>
                    <span>Weighted</span>
                    <span>Avg. chance</span>
                  </div>
                  {data.stages.map((s) => (
                    <div key={s.stage} className="grid grid-cols-[1.1fr_.6fr_2.4fr_1fr_.9fr] items-center gap-3.5 border-t border-row-line py-3 text-[13.5px]">
                      <b>
                        {s.stage}
                        {s.overdue > 0 && <span className="ml-1.5 text-xs font-semibold text-hot">{s.overdue} overdue</span>}
                      </b>
                      <span>{s.count}</span>
                      <span className="flex items-center gap-2.5">
                        <span className="h-2.5 flex-1 rounded-full bg-row-line">
                          <span className={`block h-2.5 rounded-full ${stageBar[s.stage] ?? "bg-primary"}`} style={{ width: `${(s.value / maxStage) * 100}%` }} />
                        </span>
                        <b className="w-[72px] text-right">{formatCurrency(s.value)}</b>
                      </span>
                      <span className="text-slate-600">{OPEN_STAGES.includes(s.stage) ? formatCurrency(Math.round(s.weighted)) : "–"}</span>
                      <span className="text-slate-600">{OPEN_STAGES.includes(s.stage) && s.count ? `${s.avgProb}%` : "–"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={`${card} flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 px-[22px] py-5`}>
              <h2 className="text-base font-extrabold">Closing in the next 3 weeks</h2>
              {data.closingSoon.length === 0 && <span className="text-sm text-slate-500">Nothing due to close soon.</span>}
              {data.closingSoon.map((d) => (
                <div key={d.id} className="flex justify-between gap-2.5 text-[13.5px]">
                  <span className="min-w-0">
                    <b className="block truncate">{d.title}</b>
                    <span className="text-xs text-slate-500">
                      {d.company} · {formatDate(d.closeDate)}
                    </span>
                  </span>
                  <b>{formatCurrency(d.value)}</b>
                </div>
              ))}
              <div className="flex flex-col gap-2 border-t border-row-line pt-3">
                <b className="text-[13px]">Why deals were lost</b>
                {data.lostReasons.length === 0 && <span className="text-[13px] text-slate-500">No lost deals in this period.</span>}
                {data.lostReasons.map(([r, n]) => (
                  <div key={r} className="flex justify-between text-[13px]">
                    <span>{r}</span>
                    <b>{n}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "conversion" && (
        <div className="flex flex-wrap items-start gap-4">
          <div className={`${card} flex min-w-0 flex-[1_1_360px] flex-col gap-4 px-[22px] py-5`}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-extrabold">Lead funnel</h2>
              <span className="text-sm">
                Conversion rate <b className="text-lg">{data.leads.length ? Math.round((data.converted.length / data.leads.length) * 100) : 0}%</b>
              </span>
            </div>
            {data.funnel.map((f, i) => (
              <div key={f.name} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-[13px] font-semibold">
                  <span>{f.name}</span>
                  <span className="font-medium text-slate-700">
                    {f.count}
                    {i > 0 && data.funnel[0].count ? ` · ${Math.round((f.count / data.funnel[0].count) * 100)}%` : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-subtle">
                  <div className={`h-2 rounded-full ${i === data.funnel.length - 1 ? "bg-won" : "bg-primary"}`} style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
                </div>
              </div>
            ))}
            {data.leads.length === 0 && <span className="text-sm text-slate-500">No leads created in this period.</span>}
          </div>
          <div className={`${card} min-w-0 flex-[1_1_420px] px-[22px] py-5`}>
            <h2 className="mb-3 text-base font-extrabold">Conversion by source</h2>
            <div className="grid grid-cols-[1.4fr_.8fr_.9fr_1.4fr] gap-3 pb-2 text-xs font-semibold text-slate-500">
              <span>Source</span>
              <span>Leads</span>
              <span>Converted</span>
              <span>Rate</span>
            </div>
            {data.bySource.length === 0 && <div className="border-t border-row-line py-6 text-center text-sm text-slate-500">No leads in this period.</div>}
            {data.bySource.map((r) => (
              <div key={r.src} className="grid grid-cols-[1.4fr_.8fr_.9fr_1.4fr] items-center gap-3 border-t border-row-line py-3 text-[13.5px]">
                <b>{r.src}</b>
                <span>{r.count}</span>
                <span>{r.conv}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 flex-1 rounded-full bg-row-line">
                    <span className="block h-2 rounded-full bg-primary" style={{ width: `${r.rate}%` }} />
                  </span>
                  <b className="w-9 text-right">{r.rate}%</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className={`${card} px-4 py-5 sm:px-6`}>
          <h2 className="mb-3 text-base font-extrabold">Team performance</h2>
          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[1.6fr_.8fr_.9fr_.9fr_1.1fr_.8fr_1.1fr_.8fr] gap-3 border-b border-line py-2 text-xs text-slate-500">
                <span>Rep</span>
                <span>New leads</span>
                <span>Converted</span>
                <span>Deals won</span>
                <span>Revenue won</span>
                <span>Win rate</span>
                <span>Open pipeline</span>
                <span>Tasks done</span>
              </div>
              {data.team.map((t) => (
                <div key={t.name} className="grid grid-cols-[1.6fr_.8fr_.9fr_.9fr_1.1fr_.8fr_1.1fr_.8fr] items-center gap-3 border-b border-row-line py-3 text-[13.5px]">
                  <span>
                    <b>{t.name}</b>
                    <span className="block text-xs text-slate-500">{t.role}</span>
                  </span>
                  <span>{t.leads}</span>
                  <span>{t.converted}</span>
                  <span>{t.won}</span>
                  <b>{formatCurrency(t.revenue)}</b>
                  <span>{t.winRate === null ? "–" : `${t.winRate}%`}</span>
                  <span className="text-slate-600">{formatCurrency(t.pipeline)}</span>
                  <span>{t.tasksDone}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
