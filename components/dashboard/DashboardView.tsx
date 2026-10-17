"use client";

import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import PageHeader from "@/components/layout/PageHeader";
import { priorityTone } from "@/components/tasks/TaskDetail";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { OPEN_STAGES, monthlyRevenue, toggleTask, useCrm } from "@/lib/crm-store";
import { can, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { btnPrimary, card } from "@/lib/ui";
import { getUsers } from "@/lib/users";
import { daysBetween, formatCurrency, formatDate, formatTime, isSameDay, scoreTier, timeAgo } from "@/lib/utils";

const attentionStyle = {
  hot: "bg-hot-bg text-hot",
  warm: "bg-warm-bg text-warm",
  cold: "bg-cold-bg text-cold",
} as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardView() {
  const crm = useCrm();
  const now = useNow();
  const user = useSessionUser();
  const toast = useToast();
  const showError = useErrorToast();
  if (!crm || !user) return null;

  const leads = crm.leads.filter((l) => canSee(user, l.owner));
  const deals = crm.deals.filter((d) => canSee(user, d.owner));
  const openDeals = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const wonThisMonth = deals.filter((d) => d.stage === "Won" && d.closedAt && new Date(d.closedAt) >= monthStart).reduce((s, d) => s + d.value, 0);
  const newThisWeek = openDeals.filter((d) => crm.activities.some((a) => a.dealId === d.id && a.title.startsWith("Deal created") && daysBetween(a.at) <= 7)).length;
  const converted = leads.filter((l) => l.status === "Converted").length;
  const conversion = leads.length ? (converted / leads.length) * 100 : 0;
  const leads30 = leads.filter((l) => daysBetween(l.createdAt) <= 30).length;

  const stats = [
    { label: "Total leads", value: String(leads.filter((l) => l.status !== "Converted").length), delta: `${leads30} added in 30 days`, tone: "ok" as const },
    { label: "Active deals", value: String(openDeals.length), delta: newThisWeek ? `+${newThisWeek} this week` : formatCurrency(openDeals.reduce((s, d) => s + d.value, 0)), tone: "ok" as const },
    { label: "Won this month", value: formatCurrency(wonThisMonth), delta: `${deals.filter((d) => d.stage === "Won" && d.closedAt && new Date(d.closedAt) >= monthStart).length} deals`, tone: "ok" as const },
    { label: "Lead conversion", value: `${conversion.toFixed(1)}%`, delta: `${converted} converted`, tone: conversion >= 15 ? ("ok" as const) : ("hot" as const) },
  ];

  // Revenue won in each of the last 12 months, from the won deals this user can see.
  const revenue = monthlyRevenue(deals);
  const maxRevenue = Math.max(1, ...revenue.map((r) => r.amount));

  const funnel = [
    { name: "New", count: leads.filter((l) => l.status === "New").length },
    { name: "Contacted", count: leads.filter((l) => l.status === "Contacted").length },
    { name: "Qualified", count: leads.filter((l) => l.status === "Qualified").length },
    { name: "Proposal", count: openDeals.filter((d) => d.stage === "Proposal").length },
    // Like the Won column on the pipeline: deals won in the last 30 days.
    { name: "Won (30 days)", count: deals.filter((d) => d.stage === "Won" && d.closedAt && daysBetween(d.closedAt) <= 30).length, won: true },
  ];
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  const hotLeads = leads
    .filter((l) => l.status !== "Converted")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((l) => ({ lead: l, value: deals.filter((d) => d.leadId === l.id).reduce((s, d) => s + d.value, 0) }));

  const myTasksToday = crm.tasks
    .filter((t) => !t.done && t.owner === user.short && (isSameDay(t.dueAt) || new Date(t.dueAt).getTime() < now))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 5);

  const staleHot = leads.filter((l) => l.status !== "Converted" && l.score >= 80 && daysBetween(l.lastActivityAt) >= 7);
  const overdueTasks = crm.tasks.filter((t) => !t.done && canSee(user, t.owner) && new Date(t.dueAt).getTime() < now);
  const lateDeals = openDeals.filter((d) => daysBetween(d.closeDate) > 0);
  const atRisk = crm.customers.filter((c) => canSee(user, c.owner) && c.health === "At risk");
  const attention: { id: string; text: string; tone: keyof typeof attentionStyle; href: string }[] = [
    ...(staleHot.length ? [{ id: "stale", text: `${staleHot.length} hot ${staleHot.length === 1 ? "lead has" : "leads have"} had no contact for 7 days`, tone: "hot" as const, href: "/leads" }] : []),
    ...(overdueTasks.length ? [{ id: "tasks", text: `${overdueTasks.length} ${overdueTasks.length === 1 ? "task is" : "tasks are"} overdue`, tone: "hot" as const, href: "/tasks" }] : []),
    ...lateDeals.slice(0, 2).map((d) => ({ id: d.id, text: `${d.title} is ${daysBetween(d.closeDate)} days past its close date`, tone: "warm" as const, href: `/pipeline?deal=${d.id}` })),
    ...(atRisk.length ? [{ id: "risk", text: `${atRisk.length} customer ${atRisk.length === 1 ? "account is" : "accounts are"} at risk`, tone: "cold" as const, href: "/customers" }] : []),
  ];

  // Open deals expected to close in the next 30 days (and any already overdue).
  const closingSoon = openDeals
    .filter((d) => daysBetween(d.closeDate) >= -30)
    .sort((a, b) => a.closeDate.localeCompare(b.closeDate))
    .slice(0, 5);

  // This month's results per person (admins/managers see the team, reps see themselves).
  const inMonth = (iso: string | null) => iso !== null && new Date(iso) >= monthStart;
  const leaderboard = getUsers()
    .filter((u) => (can(user, "viewAll") ? true : u.id === user.id))
    .map((u) => ({
      user: u,
      revenue: crm.deals.filter((d) => d.owner === u.short && d.stage === "Won" && inMonth(d.closedAt)).reduce((s, d) => s + d.value, 0),
      wonCount: crm.deals.filter((d) => d.owner === u.short && d.stage === "Won" && inMonth(d.closedAt)).length,
      pipeline: crm.deals.filter((d) => d.owner === u.short && OPEN_STAGES.includes(d.stage)).reduce((s, d) => s + d.value, 0),
      tasksDone: crm.tasks.filter((t) => t.owner === u.short && t.done && inMonth(t.doneAt)).length,
      converted: crm.leads.filter((l) => l.owner === u.short && l.status === "Converted" && inMonth(l.stageDates[3] ?? null)).length,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.pipeline - a.pipeline);
  const topRevenue = Math.max(1, ...leaderboard.map((r) => r.revenue));

  const recent = crm.activities
    .filter((a) => {
      if (a.leadId) {
        const l = crm.leads.find((x) => x.id === a.leadId);
        return l ? canSee(user, l.owner) : false;
      }
      if (a.customerId) {
        const c = crm.customers.find((x) => x.id === a.customerId);
        return c ? canSee(user, c.owner) : false;
      }
      return canSee(user, a.by);
    })
    .slice(0, 15);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <PageHeader title={`${greeting()}, ${user.name.split(" ")[0]}`} subtitle={`${today}. Here is what is happening with your sales today.`}>
        <Link href="/leads?new=1" className={btnPrimary}>
          + New lead
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`${card} flex flex-col gap-2 px-4 py-4 sm:px-5 sm:py-[18px]`}>
            <div className="text-[13px] text-slate-500">{s.label}</div>
            <div className="text-2xl font-extrabold tracking-tight sm:text-3xl">{s.value}</div>
            <div>
              <Badge tone={s.tone}>{s.delta}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className={`${card} flex min-w-0 flex-[999_1_420px] flex-col gap-4 px-4 py-5 sm:px-6`}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Revenue won</h2>
            <Link href="/reports" className="text-[13px] font-semibold text-primary">
              Full report
            </Link>
          </div>
          <div className="flex items-end gap-1.5 sm:gap-3">
            {revenue.map((r, i) => (
              <div key={r.month} className="flex min-w-0 flex-1 flex-col gap-2">
                <div
                  className={`w-full rounded-md ${i === revenue.length - 1 ? "bg-gradient-to-t from-primary-deep to-primary shadow-[0_0_24px_rgba(46,224,127,0.35)]" : "bg-bar hover:bg-bar-hover"}`}
                  style={{ height: Math.max(4, Math.round((r.amount / maxRevenue) * 220)) }}
                  title={`${r.month}: ${formatCurrency(r.amount)}`}
                />
                <div className="text-center text-[11px] text-slate-500">{r.month}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} flex min-w-0 flex-[1_1_300px] flex-col gap-4 px-4 py-5 sm:px-6`}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Lead funnel</h2>
            <Link href="/leads" className="text-[13px] font-semibold text-primary">
              View leads
            </Link>
          </div>
          {funnel.map((f) => (
            <div key={f.name} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px] font-semibold">
                <span>{f.name}</span>
                <span className="font-medium text-slate-700">{f.count}</span>
              </div>
              <div className="h-2 rounded-full bg-subtle">
                <div className={`h-2 rounded-full ${f.won ? "bg-won" : "bg-primary"}`} style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
        <div className={`${card} px-4 py-5 sm:px-6`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Hot leads</h2>
            <Link href="/leads" className="text-[13px] font-semibold text-primary">
              See all leads
            </Link>
          </div>
          {hotLeads.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No leads yet.</div>
          ) : (
            <>
            {/* Phones: one compact card per lead */}
            <div className="flex flex-col gap-2 md:hidden">
              {hotLeads.map(({ lead: l, value }) => {
                const t = scoreTier(l.score);
                return (
                  <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-hover">
                    <Avatar initials={l.initials} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-bold">{l.name}</div>
                      <div className="truncate text-xs text-slate-500">{l.company}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge tone={t.key}>
                        {t.label} {l.score}
                      </Badge>
                      <span className={value ? "text-[13.5px] font-bold" : "text-xs text-slate-400"}>{value ? formatCurrency(value) : "No deal yet"}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Tablet and desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <div className="min-w-[540px]">
                <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_0.9fr] gap-3 border-b border-line py-2 text-xs text-slate-500">
                  <span>Lead</span>
                  <span>Status</span>
                  <span>Score</span>
                  <span>Owner</span>
                  <span className="text-right">Value</span>
                </div>
                {hotLeads.map(({ lead: l, value }) => {
                  const t = scoreTier(l.score);
                  return (
                    <Link key={l.id} href={`/leads/${l.id}`} className="grid grid-cols-[2.2fr_1fr_1fr_1fr_0.9fr] items-center gap-3 border-b border-row-line py-3 text-[13.5px] hover:bg-hover">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar initials={l.initials} size={34} />
                        <div className="min-w-0">
                          <div className="font-bold">{l.name}</div>
                          <div className="truncate text-xs text-slate-500">{l.company}</div>
                        </div>
                      </div>
                      <span>{l.status}</span>
                      <span>
                        <Badge tone={t.key}>
                          {t.label} {l.score}
                        </Badge>
                      </span>
                      <span className="text-slate-600">{l.owner}</span>
                      <span className={`text-right ${value ? "font-bold" : "text-xs text-slate-400"}`}>{value ? formatCurrency(value) : "No deal yet"}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            </>
          )}
        </div>

        <div className={`${card} px-4 py-5 sm:px-6`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Deals closing soon</h2>
            <Link href="/pipeline" className="text-[13px] font-semibold text-primary">
              Open pipeline
            </Link>
          </div>
          {closingSoon.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">No open deals are due to close in the next 30 days.</div>
          ) : (
            <div className="flex flex-col">
              {closingSoon.map((d) => {
                const diff = -daysBetween(d.closeDate);
                const when = diff < 0 ? `${-diff} day${diff === -1 ? "" : "s"} overdue` : diff === 0 ? "Closes today" : diff === 1 ? "Closes tomorrow" : `In ${diff} days · ${formatDate(d.closeDate)}`;
                return (
                  <Link
                    key={d.id}
                    href={`/pipeline?deal=${d.id}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 border-t border-row-line py-3 first:border-t-0 hover:bg-hover sm:grid-cols-[1.6fr_1.2fr_auto]"
                  >
                    <span className="min-w-0">
                      <b className="block truncate text-[13.5px]">{d.title}</b>
                      <span className="block truncate text-xs text-slate-500">
                        {d.company} · {d.stage} · {d.owner}
                      </span>
                    </span>
                    <span className="order-3 col-span-2 flex items-center gap-2.5 sm:order-none sm:col-span-1">
                      <span className="h-1.5 flex-1 rounded-full bg-subtle">
                        <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${d.probability}%` }} />
                      </span>
                      <span className={`w-[120px] shrink-0 text-xs font-semibold ${diff < 0 ? "text-hot" : "text-slate-600"}`}>{when}</span>
                    </span>
                    <b className="text-right text-[14px]">{formatCurrency(d.value)}</b>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className={`${card} flex-1 px-4 py-5 sm:px-6`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">{can(user, "viewAll") ? "Team this month" : "Your month"}</h2>
            <Link href="/reports" className="text-[13px] font-semibold text-primary">
              Full report
            </Link>
          </div>
          {/* Phones: one compact card per rep */}
          <div className="flex flex-col gap-2 md:hidden">
            {leaderboard.map((r, i) => (
              <div key={r.user.id} className="flex flex-col gap-2.5 rounded-xl border border-line p-3 text-[13.5px]">
                <div className="flex items-center gap-2.5">
                  <Avatar initials={r.user.initials} size={30} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">
                      {r.user.short}
                      {r.user.id === user.id ? " (you)" : ""}
                    </b>
                    <span className="text-xs text-slate-500">{i === 0 && r.revenue > 0 && leaderboard.length > 1 ? "Top this month" : r.user.role}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-xs text-slate-500">Open pipeline</span>
                    <span className="font-semibold text-slate-600">{formatCurrency(r.pipeline)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="h-2 flex-1 rounded-full bg-subtle">
                    <span className="block h-2 rounded-full bg-primary" style={{ width: `${(r.revenue / topRevenue) * 100}%` }} />
                  </span>
                  <span className="w-28 shrink-0 text-right">
                    <b>{formatCurrency(r.revenue)}</b> <span className="text-xs text-slate-500">won</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet and desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[1.6fr_2fr_1fr_.8fr_.8fr] gap-3 border-b border-line py-2 text-xs text-slate-500">
                <span>Rep</span>
                <span>Revenue won</span>
                <span>Open pipeline</span>
                <span>Converted</span>
                <span>Tasks done</span>
              </div>
              {leaderboard.map((r, i) => (
                <div key={r.user.id} className="grid grid-cols-[1.6fr_2fr_1fr_.8fr_.8fr] items-center gap-3 border-b border-row-line py-3 text-[13.5px] last:border-b-0">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar initials={r.user.initials} size={30} />
                    <span className="min-w-0">
                      <b className="block truncate">
                        {r.user.short}
                        {r.user.id === user.id ? " (you)" : ""}
                      </b>
                      <span className="text-xs text-slate-500">{i === 0 && r.revenue > 0 && leaderboard.length > 1 ? "Top this month" : r.user.role}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2.5">
                    <span className="h-2 flex-1 rounded-full bg-subtle">
                      <span className="block h-2 rounded-full bg-primary" style={{ width: `${(r.revenue / topRevenue) * 100}%` }} />
                    </span>
                    <b className="w-[76px] shrink-0 text-right">{formatCurrency(r.revenue)}</b>
                  </span>
                  <span className="text-slate-600">{formatCurrency(r.pipeline)}</span>
                  <span>{r.converted}</span>
                  <span>{r.tasksDone}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <div className={`${card} flex flex-col gap-3.5 px-[22px] py-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Your tasks due today</h2>
              <Link href="/tasks" className="text-[13px] font-semibold text-primary">
                All tasks
              </Link>
            </div>
            {myTasksToday.length === 0 && (
              <div className="rounded-xl border-[1.5px] border-dashed border-bar-hover px-4 py-5 text-center">
                <b className="text-sm">You’re all caught up</b>
                <div className="text-[13px] text-slate-500">Nothing is due today.</div>
              </div>
            )}
            {myTasksToday.map((t) => {
              const overdue = new Date(t.dueAt).getTime() < now;
              return (
                <label key={t.id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Complete task: ${t.title}`}
                    onChange={() => {
                      // The box ticks at once; the message waits until the server has saved it.
                      toggleTask(t.id)
                        .then(() => toast("Task completed", { action: { label: "Undo", onClick: () => void toggleTask(t.id).catch(showError) } }))
                        .catch(showError);
                    }}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold">{t.title}</span>
                    <span className={`mt-0.5 block text-xs ${overdue ? "font-semibold text-hot" : "text-slate-500"}`}>
                      {overdue ? "Overdue · " : "Due "}
                      {isSameDay(t.dueAt) ? formatTime(t.dueAt) : timeAgo(t.dueAt)}
                      {t.contact ? ` · ${t.contact}` : ""}
                    </span>
                  </span>
                  <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
                </label>
              );
            })}
          </div>

          <div className={`${card} flex flex-col gap-3 px-[22px] py-5`}>
            <h2 className="text-base font-bold">Needs attention</h2>
            {attention.length === 0 && <div className="text-sm text-slate-500">Nothing needs attention right now.</div>}
            {attention.map((a) => (
              <Link key={a.id} href={a.href} className={`rounded-[10px] px-3.5 py-[11px] text-[13px] font-semibold hover:opacity-90 ${attentionStyle[a.tone]}`}>
                {a.text}
              </Link>
            ))}
          </div>

          <div className={`${card} flex flex-1 flex-col gap-3.5 px-[22px] py-5`}>
            <h2 className="text-base font-bold">Recent activity</h2>
            {recent.length === 0 ? (
              <div className="text-sm text-slate-500">No activity yet.</div>
            ) : (
              // The list fills whatever height the card has (it stretches to match the
              // left column). Items that don't fit are hidden behind a soft fade.
              <div className="relative min-h-[300px] flex-1">
                <div className="absolute inset-0 flex flex-col gap-3.5 overflow-hidden">
                  {recent.map((x) => (
                    <div key={x.id} className="flex shrink-0 items-start gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium">{x.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {x.by} · {timeAgo(x.at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent" />
              </div>
            )}
            {can(user, "viewAudit") && (
              <Link href="/audit-log" className="-mx-[22px] -mb-5 rounded-b-2xl border-t border-row-line px-[22px] py-3 text-center text-[13px] font-bold text-primary hover:bg-hover">
                View all activity
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
