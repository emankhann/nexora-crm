"use client";

import { useState, type FormEvent } from "react";
import { Bell } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { SelectField, TextAreaField, TextField, type Errors } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { errorMessage, formErrors } from "@/lib/api";
import { createTask, updateTask, useCrm, type TaskInput } from "@/lib/crm-store";
import { can, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary, inputCls } from "@/lib/ui";
import { getUsers } from "@/lib/users";
import { daysFromNow, fromInputs, toDateInput, toTimeInput } from "@/lib/utils";
import type { ReminderOption, TaskPriority, TaskRecord, TaskType } from "@/types";

const PRIORITIES: { value: TaskPriority; on: string }[] = [
  { value: "Low", on: "border-ok bg-primary-soft text-ok" },
  { value: "Medium", on: "border-cold bg-cold-bg text-cold" },
  { value: "High", on: "border-warm-strong bg-warm-bg text-warm" },
  { value: "Urgent", on: "border-hot bg-hot-bg text-hot" },
];
const REMINDERS: { value: ReminderOption; label: string }[] = [
  { value: "1h", label: "1 hour before" },
  { value: "15m", label: "15 minutes before" },
  { value: "1d", label: "1 day before" },
  { value: "none", label: "No reminder" },
];
const TYPES: TaskType[] = ["Call", "Email", "Meeting", "To-do"];

type Field = "title" | "date";

export type TaskDefaults = { leadId?: string | null; customerId?: string | null; dealId?: string | null; title?: string };

export default function TaskForm({
  open,
  onClose,
  task,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  task?: TaskRecord | null;
  defaults?: TaskDefaults;
}) {
  const user = useSessionUser();
  const crm = useCrm();
  const toast = useToast();
  const editing = Boolean(task);

  const initialRelated = task?.customerId && !task.leadId
    ? `customer:${task.customerId}`
    : task?.leadId
      ? `lead:${task.leadId}`
      : defaults?.customerId && !defaults.leadId
        ? `customer:${defaults.customerId}`
        : defaults?.leadId
          ? `lead:${defaults.leadId}`
          : "";
  const due = task?.dueAt ?? daysFromNow(1, 10);

  const [title, setTitle] = useState(task?.title ?? defaults?.title ?? "");
  const [related, setRelated] = useState(initialRelated);
  const [owner, setOwner] = useState(task?.owner ?? user?.short ?? "");
  const [date, setDate] = useState(toDateInput(due));
  const [time, setTime] = useState(toTimeInput(due));
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "Medium");
  const [type, setType] = useState<TaskType>(task?.type ?? "Call");
  const [reminder, setReminder] = useState<ReminderOption>(task?.reminder ?? "1h");
  const [byEmail, setByEmail] = useState(task?.remindByEmail ?? true);
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [errors, setErrors] = useState<Errors<Field>>({});
  const [saving, setSaving] = useState(false);

  if (!crm || !user) return null;

  const leads = crm.leads.filter((l) => canSee(user, l.owner) && l.status !== "Converted");
  const customers = crm.customers.filter((c) => canSee(user, c.owner));
  const ownerChoices = can(user, "reassign") ? getUsers().map((u) => u.short) : [user.short];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || !crm || saving) return;
    const errs: Errors<Field> = {};
    if (!title.trim()) errs.title = "Say what needs doing.";
    if (!date) errs.date = "Pick a due date.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const [kind, id] = related.split(":");
    const lead = kind === "lead" ? crm.leads.find((l) => l.id === id) : undefined;
    const customer = kind === "customer" ? crm.customers.find((c) => c.id === id) : lead?.customerId ? crm.customers.find((c) => c.id === lead.customerId) : undefined;

    const input: TaskInput = {
      title: title.trim(),
      type,
      priority,
      dueAt: fromInputs(date, time || "09:00"),
      reminder,
      remindByEmail: byEmail,
      owner,
      leadId: lead?.id ?? null,
      customerId: customer?.id ?? null,
      dealId: task?.dealId ?? defaults?.dealId ?? null,
      contact: lead?.name ?? customer?.contacts[0]?.name ?? "",
      company: lead?.company ?? customer?.name ?? "",
      notes: notes.trim(),
    };

    setSaving(true);
    try {
      if (task) {
        await updateTask(task.id, input);
        toast("Task saved");
      } else {
        await createTask(input);
        toast(owner === user.short ? "Task created" : `Task created and assigned to ${owner}`);
      }
      onClose();
    } catch (err) {
      const fields = formErrors(err, { title: "title", due_at: "date" } as const);
      if (fields) setErrors(fields);
      else toast(errorMessage(err), { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit task" : "New task"}
      size="md"
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="task-form" className={btnPrimary} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save task" : "Create task"}
          </button>
        </div>
      }
    >
      <form id="task-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField label="What needs doing?" required value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} placeholder="e.g. Call Ayesha about the proposal" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-[7px]">
            <label htmlFor="task-related" className="text-[13px] font-bold text-slate-800">
              Related to
            </label>
            <select id="task-related" value={related} onChange={(e) => setRelated(e.target.value)} className={inputCls}>
              <option value="">Nothing</option>
              <optgroup label="Leads">
                {leads.map((l) => (
                  <option key={l.id} value={`lead:${l.id}`}>
                    {l.name} · {l.company}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Customers">
                {customers.map((c) => (
                  <option key={c.id} value={`customer:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <SelectField
            label="Assign to"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            options={ownerChoices.map((s) => ({ value: s, label: s === user.short ? `${s} (me)` : s }))}
          />
          <TextField label="Due date" required type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
          <TextField label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_160px]">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-slate-800" id="prio-label">
              Priority
            </span>
            <div role="radiogroup" aria-labelledby="prio-label" className="grid grid-cols-4 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={priority === p.value}
                  onClick={() => setPriority(p.value)}
                  className={`h-10 rounded-[10px] border text-[13px] font-bold ${priority === p.value ? `border-[1.5px] ${p.on}` : "border-edge bg-surface text-slate-700"}`}
                >
                  {p.value}
                </button>
              ))}
            </div>
          </div>
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as TaskType)} options={TYPES} />
        </div>

        <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-hover px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-primary-soft text-primary">
              <Bell size={16} />
            </span>
            <label htmlFor="task-reminder" className="flex-1 text-sm font-bold">
              Reminder
            </label>
            <select id="task-reminder" value={reminder} onChange={(e) => setReminder(e.target.value as ReminderOption)} className={`${inputCls} h-[38px] w-[190px] text-[13px]`}>
              {REMINDERS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-[18px] text-[13px] font-semibold text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked disabled className="h-4 w-4 accent-primary" />
              In the app (bell)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={byEmail} disabled={reminder === "none"} onChange={(e) => setByEmail(e.target.checked)} className="h-4 w-4 accent-primary" />
              Email
            </label>
          </div>
        </div>
        <TextAreaField label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the assignee should know" />
      </form>
    </Modal>
  );
}
