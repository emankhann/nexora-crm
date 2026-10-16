"use client";

import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { createTask, logActivity } from "@/lib/crm-store";
import { useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary, inputCls } from "@/lib/ui";
import { daysFromNow, fromInputs, toDateInput, toTimeInput } from "@/lib/utils";

export type ActivityKindChoice = "call" | "email" | "meeting";

const OUTCOMES: Record<ActivityKindChoice, string[]> = {
  call: ["Interested", "Needs follow-up", "No answer", "Not interested"],
  email: ["Sent", "Replied", "No reply yet"],
  meeting: ["Went well", "Needs follow-up", "Rescheduled", "Cancelled"],
};

/**
 * Log a call, email or meeting against a lead or customer, with an
 * optional follow-up task. Saves to the communication history.
 */
export default function LogActivityDialog({
  open,
  onClose,
  initialKind = "call",
  target,
}: {
  open: boolean;
  onClose: () => void;
  initialKind?: ActivityKindChoice;
  target: { name: string; company: string; leadId?: string; customerId?: string; email?: string };
}) {
  const user = useSessionUser();
  const toast = useToast();
  const now = new Date().toISOString();
  const [kind, setKind] = useState<ActivityKindChoice>(initialKind);
  const [outcome, setOutcome] = useState(OUTCOMES[initialKind][0]);
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(toDateInput(now));
  const [time, setTime] = useState(toTimeInput(now));
  const [duration, setDuration] = useState("15");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState(true);
  const [fuDate, setFuDate] = useState(toDateInput(daysFromNow(2)));
  const [error, setError] = useState("");
  // Open the user's email app (Outlook, Gmail, Mail…) with the message filled in.
  const [openMail, setOpenMail] = useState(Boolean(target.email));

  function pick(k: ActivityKindChoice) {
    setKind(k);
    setOutcome(OUTCOMES[k][0]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (kind === "email" && !subject.trim()) {
      setError("Add the email subject.");
      return;
    }
    const mins = Number(duration);
    const title =
      kind === "call"
        ? `Call logged${mins ? ` (${mins} min)` : ""}: ${outcome.toLowerCase()}`
        : kind === "email"
          ? `Email ${outcome === "Replied" ? "reply" : "sent"}: ${subject.trim()}`
          : `Meeting${mins ? ` (${mins} min)` : ""}: ${outcome.toLowerCase()}`;
    logActivity(
      {
        kind,
        title,
        meta: [user.short, notes.trim()].filter(Boolean).join(" · "),
        leadId: target.leadId,
        customerId: target.customerId,
        at: date ? fromInputs(date, time || "09:00") : undefined,
      },
      user
    );
    if (followUp && fuDate) {
      createTask(
        {
          title: `Follow up with ${target.name}`,
          type: kind === "email" ? "Email" : "Call",
          priority: outcome === "Interested" || outcome === "Replied" ? "High" : "Medium",
          dueAt: fromInputs(fuDate, "10:00"),
          reminder: "1h",
          remindByEmail: true,
          owner: user.short,
          leadId: target.leadId ?? null,
          customerId: target.customerId ?? null,
          dealId: null,
          contact: target.name,
          company: target.company,
          notes: notes.trim(),
        },
        user
      );
    }
    const sendNow = kind === "email" && openMail && target.email && outcome === "Sent";
    toast(
      `${kind === "call" ? "Call" : kind === "email" ? "Email" : "Meeting"} saved${followUp ? " · follow-up task created" : ""}${sendNow ? " · opening your email app" : ""}`
    );
    onClose();
    if (sendNow && target.email) {
      const href = `mailto:${encodeURIComponent(target.email)}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(notes.trim())}`;
      window.location.href = href;
    }
  }

  const tabs: { k: ActivityKindChoice; label: string }[] = [
    { k: "call", label: "Call" },
    { k: "email", label: "Email" },
    { k: "meeting", label: "Meeting" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Log activity with ${target.name}`}
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="log-activity" className={btnPrimary}>
            {kind === "email" && openMail && target.email && outcome === "Sent" ? "Save and open email" : `Save ${kind}`}
          </button>
        </div>
      }
    >
      <form id="log-activity" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div role="tablist" aria-label="Activity type" className="flex gap-1.5 rounded-xl bg-[#F0F3FB] p-1">
          {tabs.map((t) => (
            <button
              key={t.k}
              type="button"
              role="tab"
              aria-selected={kind === t.k}
              onClick={() => pick(t.k)}
              className={`h-9 flex-1 rounded-[9px] text-[13.5px] font-bold ${kind === t.k ? "bg-white text-navy shadow-[0_1px_3px_rgba(15,23,42,0.12)]" : "text-slate-600"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {kind === "email" && (
          <TextField
            label="Subject"
            required
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setError("");
            }}
            error={error}
            placeholder="e.g. Fleet tracking proposal – next steps"
            hint={target.email ? `To ${target.email}` : undefined}
          />
        )}

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold">Outcome</span>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES[kind].map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={outcome === o}
                onClick={() => setOutcome(o)}
                className={`h-[34px] rounded-full border px-3.5 text-[13px] font-semibold ${
                  outcome === o ? "border-navy bg-navy text-white" : "border-[#D5DCEC] bg-white"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          {kind !== "email" && (
            <TextField label="Duration (min)" type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
          )}
        </div>
        <TextAreaField
          label={kind === "email" ? "Message" : "Notes"}
          rows={kind === "email" ? 5 : 3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={kind === "email" ? `Hi ${target.name.split(" ")[0]},` : "What was discussed? What happens next?"}
        />
        {kind === "email" && target.email && outcome === "Sent" && (
          <label className="-mt-1 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
            <input type="checkbox" checked={openMail} onChange={(e) => setOpenMail(e.target.checked)} className="h-[17px] w-[17px] accent-primary" />
            Open in my email app to send it
          </label>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line px-3.5 py-3">
          <label className="flex flex-1 items-center gap-2 text-[13.5px] font-bold">
            <input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} className="h-[17px] w-[17px] accent-primary" />
            Create a follow-up task
          </label>
          <input
            type="date"
            aria-label="Follow-up date"
            value={fuDate}
            disabled={!followUp}
            onChange={(e) => setFuDate(e.target.value)}
            className={`${inputCls} h-9 w-[170px] text-[13px] disabled:opacity-50`}
          />
        </div>
      </form>
    </Modal>
  );
}
