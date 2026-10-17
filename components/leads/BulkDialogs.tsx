"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { LEAD_STATUSES, assignLeads, setLeadsStatus, useCrm } from "@/lib/crm-store";
import { useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary } from "@/lib/ui";
import { getUsers } from "@/lib/users";
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
  const [owner, setOwner] = useState(() => (leads.length === 1 ? leads[0].owner : getUsers()[0]?.short ?? "Unassigned"));
  const [query, setQuery] = useState("");
  const [notify, setNotify] = useState(true);

  const openCount = (short: string) => crm?.leads.filter((l) => l.owner === short && l.status !== "Converted").length ?? 0;
  const options = [
    ...getUsers().map((u) => ({ short: u.short, title: u.name, sub: `${u.role} · ${openCount(u.short)} open leads`, initials: u.initials })),
    { short: "Unassigned", title: "Unassigned", sub: "Leave without an owner", initials: "–" },
  ].filter((o) => !query.trim() || o.title.toLowerCase().includes(query.trim().toLowerCase()));

  function save() {
    if (!user) return;
    const prev = leads.map((l) => ({ id: l.id, owner: l.owner }));
    assignLeads(
      leads.map((l) => l.id),
      owner,
      user
    );
    toast(`${leads.length} ${leads.length === 1 ? "lead" : "leads"} assigned to ${owner}${notify && owner !== "Unassigned" ? " · they’ll be notified" : ""}`, {
      action: {
        label: "Undo",
        onClick: () => prev.forEach((p) => assignLeads([p.id], p.owner, user)),
      },
    });
    onDone?.();
    onClose();
  }

  const label = owner === "Unassigned" ? "Unassign" : `Assign to ${owner.split(" ")[0]}`;

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
          <button type="button" className={btnPrimary} onClick={save}>
            {label}
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
          <RadioRow key={o.short} checked={owner === o.short} onSelect={() => setOwner(o.short)} title={o.title} sub={o.sub} initials={o.initials} />
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

  function save() {
    if (!user) return;
    setLeadsStatus(
      leads.map((l) => l.id),
      status,
      user
    );
    toast(`${leads.length} ${leads.length === 1 ? "lead" : "leads"} marked ${status}`);
    onDone?.();
    onClose();
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
          <button type="button" className={btnPrimary} onClick={save}>
            Set to {status}
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
