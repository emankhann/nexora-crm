"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import PageHeader from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import TaskForm from "@/components/tasks/TaskForm";
import TaskDetail, { priorityTone } from "@/components/tasks/TaskDetail";
import { toggleTask, useCrm } from "@/lib/crm-store";
import { can, canEdit, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnPrimary, card, chipCls, chipCountCls, searchCls, selectCls } from "@/lib/ui";
import { initialsForOwner, users } from "@/lib/users";
import { formatDue, isSameDay } from "@/lib/utils";
import type { TaskRecord } from "@/types";

type TabKey = "open" | "today" | "overdue" | "upcoming" | "done";
const tabs: { key: TabKey; label: string }[] = [
  { key: "open", label: "All open" },
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "done", label: "Done" },
];
const priorityRank = { Urgent: 0, High: 1, Medium: 2, Low: 3 } as const;

function bucket(t: TaskRecord): "overdue" | "today" | "upcoming" {
  const due = new Date(t.dueAt).getTime();
  if (due < Date.now()) return "overdue";
  return isSameDay(t.dueAt) ? "today" : "upcoming";
}

function inTab(t: TaskRecord, tab: TabKey) {
  if (tab === "done") return t.done;
  if (t.done) return false;
  if (tab === "open") return true;
  // "Today" includes anything still due today, overdue items have their own tab.
  return bucket(t) === tab;
}

export default function TasksBoard() {
  const crm = useCrm();
  const user = useSessionUser();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<TabKey>("open");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("Any");
  const [owner, setOwner] = useState("Anyone");
  const [form, setForm] = useState<null | { task?: TaskRecord }>(() => (params.get("new") === "1" ? {} : null));
  const [detailId, setDetailId] = useState<string | null>(() => params.get("open"));
  const [k, setK] = useState(0);

  // Links from search and reminders while already on this page.
  const pOpen = params.get("open");
  const pNew = params.get("new");
  const [last, setLast] = useState(`${pOpen}|${pNew}`);
  if (`${pOpen}|${pNew}` !== last) {
    setLast(`${pOpen}|${pNew}`);
    if (pOpen) setDetailId(pOpen);
    if (pNew === "1") {
      setK((x) => x + 1);
      setForm({});
    }
  }

  const tasks = useMemo(() => (crm && user ? crm.tasks.filter((t) => canSee(user, t.owner)) : []), [crm, user]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter(
        (t) =>
          inTab(t, tab) &&
          (!q || [t.title, t.contact, t.company].some((v) => v.toLowerCase().includes(q))) &&
          (priority === "Any" || t.priority === priority) &&
          (owner === "Anyone" || t.owner === owner)
      )
      .sort((a, b) =>
        tab === "done"
          ? (b.doneAt ?? "").localeCompare(a.doneAt ?? "")
          : a.dueAt.localeCompare(b.dueAt) || priorityRank[a.priority] - priorityRank[b.priority]
      );
  }, [tasks, tab, query, priority, owner]);

  if (!crm || !user) return null;

  const open = tasks.filter((t) => !t.done);
  const stats = [
    { label: "Open tasks", value: open.length, note: can(user, "viewAll") ? "Across the team" : "Assigned to you", danger: false },
    { label: "Due today", value: open.filter((t) => bucket(t) === "today").length, note: "Finish these before end of day", danger: false },
    { label: "Overdue", value: open.filter((t) => bucket(t) === "overdue").length, note: "Past their due date", danger: true },
  ];
  const detail = detailId ? crm.tasks.find((t) => t.id === detailId) : null;

  function clearParams() {
    if (params.get("open") || params.get("new")) router.replace("/tasks");
  }

  return (
    <>
      <PageHeader title="Tasks" subtitle="Follow-ups and to-dos across your leads and deals.">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setK((x) => x + 1);
            setForm({});
          }}
        >
          + New task
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`${card} flex flex-col gap-2 px-5 py-[18px]`}>
            <div className="text-[13px] text-slate-500">{s.label}</div>
            <div className={`text-3xl font-extrabold tracking-tight ${s.danger && s.value > 0 ? "text-hot" : ""}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.note}</div>
          </div>
        ))}
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {tabs.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={chipCls(tab === t.key)}>
                {t.label}
                <span className={chipCountCls(tab === t.key)}>{tasks.filter((x) => inTab(x, t.key)).length}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              aria-label="Filter tasks"
              placeholder="Filter by task, contact or company"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${searchCls} basis-full sm:basis-auto`}
            />
            <label className="flex items-center gap-2 text-[13px] text-slate-500">
              Priority
              <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {["Any", "Urgent", "High", "Medium", "Low"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            {can(user, "viewAll") && (
              <label className="flex items-center gap-2 text-[13px] text-slate-500">
                Assigned to
                <select className={selectCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
                  {["Anyone", ...users.map((u) => u.short)].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="border-t border-line">
          {visible.length === 0 &&
            (tab === "today" && !query && priority === "Any" ? (
              <EmptyState
                icon={
                  <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-primary-soft text-ok">
                    <CheckCircle2 size={28} />
                  </span>
                }
                title="You’re all caught up"
                body="Nothing else is due today."
              />
            ) : (
              <EmptyState title={tab === "done" ? "No completed tasks yet" : "No tasks match your filters"} />
            ))}

          {visible.map((t) => {
            const b = bucket(t);
            const editable = canEdit(user, t.owner);
            return (
              <div key={t.id} className="flex flex-wrap items-start gap-3.5 border-t border-row-line px-4 py-4 first:border-t-0 hover:bg-hover sm:px-5">
                <input
                  type="checkbox"
                  aria-label={`${t.done ? "Reopen" : "Complete"} task: ${t.title}`}
                  checked={t.done}
                  disabled={!editable}
                  onChange={() => {
                    toggleTask(t.id, user);
                    if (!t.done) toast("Task completed", { action: { label: "Undo", onClick: () => toggleTask(t.id, user) } });
                  }}
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-primary"
                />
                <div className={`min-w-0 flex-1 ${t.done ? "opacity-60" : ""}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setK((x) => x + 1);
                      setDetailId(t.id);
                    }}
                    className={`text-left text-[14px] font-semibold hover:text-primary ${t.done ? "line-through" : ""}`}
                  >
                    {t.title}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    {t.leadId ? (
                      <Link href={`/leads/${t.leadId}`} className="font-semibold text-primary">
                        {t.contact}
                      </Link>
                    ) : t.customerId ? (
                      <Link href={`/customers/${t.customerId}`} className="font-semibold text-primary">
                        {t.contact || t.company}
                      </Link>
                    ) : (
                      t.contact && <span>{t.contact}</span>
                    )}
                    {t.company && (
                      <>
                        <span>·</span>
                        <span>{t.company}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className={!t.done && b === "overdue" ? "font-semibold text-hot" : ""}>
                      {!t.done && b === "overdue" ? `Overdue, was due ${formatDue(t.dueAt)}` : `Due ${formatDue(t.dueAt)}`}
                    </span>
                    {t.followUps.length > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          {t.followUps.length} follow-up{t.followUps.length === 1 ? "" : "s"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>
                <span title={t.owner}>
                  <Avatar initials={initialsForOwner(t.owner)} size={30} />
                </span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-row-line px-5 py-4 text-[13px] text-slate-500">
          Showing {visible.length} of {tasks.length} tasks
        </div>
      </div>

      {form && (
        <TaskForm
          key={`f${k}`}
          open
          task={form.task}
          onClose={() => {
            setForm(null);
            clearParams();
          }}
        />
      )}
      {detail && !form && (
        <TaskDetail
          key={`d${k}-${detail.id}`}
          task={detail}
          onClose={() => {
            setDetailId(null);
            clearParams();
          }}
          onEdit={() => {
            setK((x) => x + 1);
            setForm({ task: detail });
          }}
        />
      )}
    </>
  );
}
