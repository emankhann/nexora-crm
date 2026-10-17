import type { CrmState } from "@/lib/crm-store";
import { OPEN_STAGES } from "@/lib/crm-store";
import { canSee } from "@/lib/permissions";
import type { SessionUser } from "@/lib/users";
import { daysBetween, formatCurrency, formatDue, timeAgo } from "@/lib/utils";

export type Notice = {
  id: string;
  kind: "due" | "overdue" | "assigned" | "deal";
  title: string;
  meta: string;
  href: string;
  at: string;
};

const REMINDER_MS = { none: 0, "15m": 15 * 60e3, "1h": 60 * 60e3, "1d": 24 * 60 * 60e3 } as const;

/**
 * Reminders for the bell, worked out from the data:
 * tasks whose reminder time has passed, overdue tasks, leads/tasks
 * assigned to you in the last 3 days, and open deals past their close date.
 */
export function buildNotices(s: CrmState, user: SessionUser): Notice[] {
  const now = Date.now();
  const out: Notice[] = [];

  for (const t of s.tasks) {
    if (t.done || t.owner !== user.short) continue;
    const due = new Date(t.dueAt).getTime();
    if (due < now) {
      out.push({
        id: `overdue:${t.id}:${t.dueAt}`,
        kind: "overdue",
        title: `Overdue: ${t.title}`,
        meta: `Task · was due ${formatDue(t.dueAt)}`,
        href: `/tasks?open=${t.id}`,
        at: t.dueAt,
      });
    } else if (t.reminder !== "none" && due - REMINDER_MS[t.reminder] <= now) {
      out.push({
        id: `due:${t.id}:${t.dueAt}`,
        kind: "due",
        title: `Due soon: ${t.title}`,
        meta: `Task · ${formatDue(t.dueAt)}`,
        href: `/tasks?open=${t.id}`,
        at: new Date(due - REMINDER_MS[t.reminder]).toISOString(),
      });
    }
  }

  for (const a of s.activities) {
    if (a.kind !== "assigned" || a.assignee !== user.short || a.by === user.short) continue;
    if (now - new Date(a.at).getTime() > 3 * 24 * 60 * 60e3) continue;
    out.push({
      id: `assigned:${a.id}`,
      kind: "assigned",
      title: a.taskId
        ? `${a.by} assigned you a task: ${a.title.replace(/^Task assigned to [^:]+: /, "")}`
        : `${a.by} assigned you a lead: ${a.title.replace(/ assigned to .*$/, "")}`,
      meta: timeAgo(a.at),
      href: a.taskId ? `/tasks?open=${a.taskId}` : a.leadId ? `/leads/${a.leadId}` : "/leads",
      at: a.at,
    });
  }

  for (const d of s.deals) {
    if (!OPEN_STAGES.includes(d.stage) || !canSee(user, d.owner)) continue;
    const late = daysBetween(d.closeDate);
    if (late > 0) {
      out.push({
        id: `deal:${d.id}:${d.closeDate}`,
        kind: "deal",
        title: `${d.title} is ${late} day${late === 1 ? "" : "s"} past its close date`,
        meta: `Deal · ${d.company} · ${formatCurrency(d.value)}`,
        href: `/pipeline?deal=${d.id}`,
        at: d.closeDate,
      });
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at));
}
