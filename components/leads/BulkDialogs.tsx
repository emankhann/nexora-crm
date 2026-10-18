"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { LEAD_STATUSES, assignLeads, setLeadsStatus, useCrm } from "@/lib/crm-store";
import { useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary } from "@/lib/ui";
import { getUsers, NO_OWNER, userById } from "@/lib/users";
import type { LeadRecord, LeadStatus } from "@/types";

function names(leads: LeadRecord[]) {
  if (leads.length <= 3) return leads.map((l) => l.name).join(", ").replace(/, ([^,]*)$/, " and $1");
  return `${leads.slice(0, 2).map((l) => l.name).join(", ")} and ${leads.length - 2} more`;
}

function RadioRow({
  checked,
  onSelect,
  title,
  sub,
  initials,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  sub: string;
  initials?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2.5 text-left ${
        checked ? "border-primary bg-primary-soft" : "border-transparent hover:bg-slate-50"
      }`}
    >
      {initials !== undefined && (
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-avatar text-avatar-text ring-1 ring-ok-border text-xs font-bold">{initials}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-sm">{title}</b>
        <span className="text-xs text-slate-500">{sub}</span>
      </span>
      <span className={`h-[18px] w-[18px] shrink-0 rounded-full bg-surface ${checked ? "border-[5px] border-primary" : "border-2 border-faint"}`} />
    </button>
  );
}

export function AssignOwnerDialog({ open, onClose, leads, onDone }: { open: boolean; onClose: () => void; leads: LeadRecord[]; onDone?: () => void }) {
  const crm = useCrm();
  const user = useSessionUser();
  const toast = useToast();
  const [ownerId, setOwnerId] = useState(() => (leads.length === 1 ? leads[0].ownerId : (getUsers()[0]?.id ?? NO_OWNER)));
  const [query, setQuery] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const showError = useErrorToast();

  const openCount = (id: string) => crm?.leads.filter((l) => l.ownerId === id && l.status !== "Converted").length ?? 0;
  const options = [
    ...getUsers().map((u) => ({ id: u.id, title: u.name, sub: `${u.role} · ${openCount(u.id)} open leads`, initials: u.initials })),
    { id: NO_OWNER, title: "Unassigned", sub: "Leave without an owner", initials: "–" },
  ].filter((o) => !query.trim() || o.title.toLowerCase().includes(query.trim().toLowerCase()));

  const chosen = userById(ownerId);

  async function save() {
    if (!user || saving) return;
    // Previous owners, grouped, so Undo can put each lead back with one request per owner.
    const prev = new Map<string, string[]>();
    for (const l of leads) prev.set(l.ownerId, [...(prev.get(l.ownerId) ?? []), l.id]);
    setSaving(true);
    try {
      await assignLeads(
        leads.map((l) => l.id),
        ownerId
      );
      const who = chosen ? chosen.short : "nobody";
      toast(`${leads.length} ${leads.length === 1 ? "lead" : "leads"} assigned to ${who}${notify && chosen ? " · they’ll be notified" : ""}`, {
        action: {
          label: "Undo",
          onClick: () => {
            Promise.all([...prev].map(([o, ids]) => assignLeads(ids, o))).catch(showError);
          },
        },
      });
      onDone?.();
      onClose();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  const label = chosen ? `Assign to ${chosen.name.split(" ")[0]}` : "Unassign";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={leads.length === 1 ? `Assign ${leads[0].name}` : `Assign ${leads.length} leads`}
      description={`${names(leads)} will move to the person you pick.`}
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : label}
          </button>
        </div>
      }
    >
      <input
        aria-label="Search team members"
        placeholder="Search team members"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2.5 h-10 w-full rounded-xl border border-transparent bg-muted px-3.5 text-[13.5px] outline-none focus:border-accent focus:bg-surface"
      />
      <div role="radiogroup" aria-label="New owner" className="flex flex-col gap-1">
        {options.map((o) => (
          <RadioRow key={o.id || "none"} checked={ownerId === o.id} onSelect={() => setOwnerId(o.id)} title={o.title} sub={o.sub} initials={o.initials} />
        ))}
      </div>
      <label className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-[17px] w-[17px] accent-primary" />
        Notify the new owner
      </label>
    </Modal>
  );
}

const statusSub: Record<string, string> = {
  New: "Not contacted yet",
  Contacted: "Replied or took a call",
  Qualified: "Has budget, need and a decision maker",
  Unqualified: "Not a fit right now",
};

export function ChangeStatusDialog({ open, onClose, leads, onDone }: { open: boolean; onClose: () => void; leads: LeadRecord[]; onDone?: () => void }) {
  const user = useSessionUser();
  const toast = useToast();
  const [status, setStatus] = useState<LeadStatus>(() => (leads.length === 1 && leads[0].status !== "Converted" ? leads[0].status : "Contacted"));
  const [saving, setSaving] = useState(false);
  const showError = useErrorToast();

  async function save() {
    if (!user || saving) return;
    setSaving(true);
    try {
      await setLeadsStatus(
        leads.map((l) => l.id),
        status
      );
      toast(`${leads.length} ${leads.length === 1 ? "lead" : "leads"} marked ${status}`);
      onDone?.();
      onClose();
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Change status"
      description={names(leads)}
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : `Set to ${status}`}
          </button>
        </div>
      }
    >
      <div role="radiogroup" aria-label="Status" className="flex flex-col gap-1">
        {LEAD_STATUSES.map((s) => (
          <RadioRow key={s} checked={status === s} onSelect={() => setStatus(s)} title={s} sub={statusSub[s]} />
        ))}
      </div>
    </Modal>
  );
}
