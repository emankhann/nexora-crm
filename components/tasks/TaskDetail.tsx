"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { addFollowUp, deleteTask, snoozeTask, toggleTask, useCrm } from "@/lib/crm-store";
import { can, canEdit } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { btnGhostDanger, btnOutline, btnPrimary, inputCls } from "@/lib/ui";
import { daysFromNow, formatDue, timeAgo } from "@/lib/utils";
import type { TaskRecord } from "@/types";

export const priorityTone = { Urgent: "hot", High: "warm", Medium: "cold", Low: "neutral" } as const;

const OUTCOMES = ["Reached", "No answer", "Left voicemail", "Email sent", "Replied", "Meeting booked"];
const NEXT = [
  { value: "2", label: "Next: in 2 days" },
  { value: "1", label: "Next: tomorrow" },
  { value: "7", label: "Next: in a week" },
  { value: "close", label: "Done, close the task" },
];

const outcomeDot: Record<string, string> = {
  "No answer": "border-[#B42318] bg-[#FDE4E4]",
  "Left voicemail": "border-[#B42318] bg-[#FDE4E4]",
  Snoozed: "border-[#B7791F] bg-[#FEF0CF]",
};

/** Task panel: details, quick actions and the follow-up history. */
export default function TaskDetail({ task, onClose, onEdit }: { task: TaskRecord; onClose: () => void; onEdit: () => void }) {
  const crm = useCrm();
  const now = useNow();
  const user = useSessionUser();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [next, setNext] = useState("2");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!crm || !user) return null;
  const editable = canEdit(user, task.owner);
  const overdue = !task.done && new Date(task.dueAt).getTime() < now;
  const lead = task.leadId ? crm.leads.find((l) => l.id === task.leadId) : null;
  const customer = task.customerId ? crm.customers.find((c) => c.id === task.customerId) : null;

  function log() {
    if (!user) return;
    const close = next === "close";
    addFollowUp(task.id, { outcome, note: note.trim(), rescheduledTo: close ? null : daysFromNow(Number(next), 10), closeTask: close }, user);
    setNote("");
    toast(close ? "Follow-up logged and task closed" : "Follow-up logged and task rescheduled");
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        variant="right"
        title={task.title}
        description={
          <span className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={priorityTone[task.priority]}>{task.priority}</Badge>
            <Badge tone="cold">{task.type}</Badge>
            {task.done && <Badge tone="ok">Done</Badge>}
          </span>
        }
        footer={
          <>
            {(can(user, "delete") || task.createdBy === user.short) ? (
              <button type="button" className={btnGhostDanger} onClick={() => setConfirmDelete(true)}>
                Delete task
              </button>
            ) : (
              <span />
            )}
            <button type="button" className={btnOutline} onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-[#F7F9FD] px-3.5 py-3 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-slate-500">Due</span>
              <span className={`text-[13.5px] font-bold ${overdue ? "text-[#B42318]" : ""}`}>
                {overdue ? "Overdue · " : ""}
                {formatDue(task.dueAt)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-slate-500">Assigned to</span>
              <span className="text-[13.5px] font-bold">{task.owner}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold text-slate-500">Related to</span>
              {lead ? (
                <Link href={`/leads/${lead.id}`} className="truncate text-[13.5px] font-bold text-primary">
                  {lead.name}
                </Link>
              ) : customer ? (
                <Link href={`/customers/${customer.id}`} className="truncate text-[13.5px] font-bold text-primary">
                  {customer.name}
                </Link>
              ) : (
                <span className="text-[13.5px] font-bold">{task.contact || "–"}</span>
              )}
            </div>
          </div>

          {task.notes && <p className="rounded-xl border border-line px-3.5 py-3 text-[13.5px] leading-relaxed text-slate-700">{task.notes}</p>}

          {editable && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                onClick={() => {
                  toggleTask(task.id, user);
                  toast(task.done ? "Task reopened" : "Task completed");
                  if (!task.done) onClose();
                }}
              >
                {task.done ? "Reopen task" : "Mark done"}
              </button>
              {!task.done && (
                <button
                  type="button"
                  className={btnOutline}
                  onClick={() => {
                    snoozeTask(task.id, daysFromNow(1, new Date(task.dueAt).getHours(), new Date(task.dueAt).getMinutes()), user);
                    toast("Snoozed to tomorrow");
                  }}
                >
                  Snooze to tomorrow
                </button>
              )}
              <button type="button" className={btnOutline} onClick={onEdit}>
                Edit
              </button>
            </div>
          )}

          <div className="flex items-baseline justify-between">
            <h3 className="text-[15px] font-extrabold">Follow-up history</h3>
            <span className="text-xs text-slate-500">
              {task.followUps.length} {task.followUps.length === 1 ? "attempt" : "attempts"}
            </span>
          </div>

          {editable && !task.done && (
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-line p-3">
              <label htmlFor="fu-note" className="sr-only">
                What happened on this follow-up?
              </label>
              <textarea
                id="fu-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What happened on this follow-up?"
                className="resize-none text-[13.5px] outline-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} className={`${inputCls} h-[34px] w-auto text-[12.5px]`}>
                  {OUTCOMES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                <select aria-label="Next follow-up" value={next} onChange={(e) => setNext(e.target.value)} className={`${inputCls} h-[34px] w-auto text-[12.5px]`}>
                  {NEXT.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={log} className={`${btnPrimary} ml-auto h-[34px]`}>
                  Log
                </button>
              </div>
            </div>
          )}

          <ol className="flex flex-col pl-1">
            {task.followUps.map((f) => (
              <li key={f.id} className="relative ml-[9px] border-l-2 border-line pb-[18px] pl-[18px]">
                <span className={`absolute -left-[10px] top-0 h-[18px] w-[18px] rounded-full border-2 ${outcomeDot[f.outcome] ?? "border-primary bg-[#E6EAFE]"}`} />
                <b className="text-[13.5px]">{f.outcome}</b>
                {f.note && <div className="mt-0.5 text-[12.5px] text-slate-600">{f.note}</div>}
                <div className="mt-0.5 text-xs text-slate-500">
                  {timeAgo(f.at)} · {f.by}
                  {f.rescheduledTo ? ` · moved to ${formatDue(f.rescheduledTo)}` : ""}
                </div>
              </li>
            ))}
            {task.done && task.doneAt && (
              <li className="relative ml-[9px] border-l-2 border-line pb-[18px] pl-[18px]">
                <span className="absolute -left-[10px] top-0 h-[18px] w-[18px] rounded-full border-2 border-[#14663D] bg-[#EAF8EE]" />
                <b className="text-[13.5px]">Completed</b>
                <div className="mt-0.5 text-xs text-slate-500">{timeAgo(task.doneAt)}</div>
              </li>
            )}
            <li className="relative ml-[9px] border-l-2 border-transparent pl-[18px]">
              <span className="absolute -left-[10px] top-0 h-[18px] w-[18px] rounded-full border-2 border-slate-400 bg-[#F3F6FB]" />
              <b className="text-[13.5px]">Task created by {task.createdBy}</b>
              <div className="mt-0.5 text-xs text-slate-500">
                {timeAgo(task.createdAt)}
                {task.reminder !== "none" ? ` · reminder ${task.reminder === "15m" ? "15 min" : task.reminder === "1h" ? "1 hour" : "1 day"} before` : ""}
              </div>
            </li>
          </ol>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        size="sm"
        alert
        title="Delete this task?"
        footer={
          <div className="ml-auto flex gap-2.5">
            <button type="button" className={btnOutline} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-xl bg-[#B42318] px-[18px] text-[13.5px] font-bold text-white"
              onClick={() => {
                deleteTask(task.id, user);
                toast("Task deleted");
                setConfirmDelete(false);
                onClose();
              }}
            >
              Delete task
            </button>
          </div>
        }
      >
        <p className="text-[13.5px] text-slate-600">“{task.title}” and its follow-up history will be removed.</p>
      </Modal>
    </>
  );
}
