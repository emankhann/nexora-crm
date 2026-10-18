"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import { TextField, type Errors } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/States";
import NotFoundView from "@/components/ui/NotFoundView";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { errorMessage, formErrors } from "@/lib/api";
import ActivityFeed from "@/components/activity/ActivityFeed";
import CustomerForm from "@/components/customers/CustomerForm";
import LogActivityDialog, { type ActivityKindChoice } from "@/components/leads/LogActivityDialog";
import DealForm from "@/components/pipeline/DealForm";
import TaskForm from "@/components/tasks/TaskForm";
import { OPEN_STAGES, addContact, deleteCustomer, logActivity, toggleTask, useCrm } from "@/lib/crm-store";
import { can, canEdit, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { btnOutline, btnPrimary, card } from "@/lib/ui";
import { formatCurrency, formatDate, formatDue, isEmail, isPhone, timeAgo } from "@/lib/utils";
import type { DealRecord } from "@/types";

const healthTone = { Healthy: "ok", Watch: "warm", "At risk": "hot" } as const;

type Dialog = null | { kind: "edit" } | { kind: "log"; activity: ActivityKindChoice } | { kind: "deal"; deal?: DealRecord } | { kind: "task" } | { kind: "contact" } | { kind: "delete" };

function AddContactDialog({ open, onClose, customerId }: { open: boolean; onClose: () => void; customerId: string }) {
  const user = useSessionUser();
  const toast = useToast();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Errors<"name" | "title" | "email" | "phone">>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || saving) return;
    const errs: Errors<"name" | "email" | "phone"> = {};
    if (!name.trim()) errs.name = "Enter a name.";
    if (email && !isEmail(email)) errs.email = "Enter a valid email.";
    if (!isPhone(phone)) errs.phone = "Use digits, spaces, + ( ) or -.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await addContact(customerId, { name: name.trim(), title: title.trim(), email: email.trim(), phone: phone.trim(), primary: false });
      toast(`${name.trim()} added`);
      onClose();
    } catch (err) {
      const fields = formErrors(err, { name: "name", job_title: "title", email: "email", phone: "phone" } as const);
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
      size="sm"
      title="Add contact"
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="contact-form" className={btnPrimary} disabled={saving}>
            {saving ? "Saving…" : "Add contact"}
          </button>
        </div>
      }
    >
      <form id="contact-form" onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextField label="Job title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
      </form>
    </Modal>
  );
}

export default function CustomerProfileView({ id }: { id: string }) {
  const crm = useCrm();
  const now = useNow();
  const user = useSessionUser();
  const toast = useToast();
  const showError = useErrorToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const router = useRouter();
  const [n, setN] = useState(0);

  if (!crm || !user) return null;
  const c = crm.customers.find((x) => x.id === id);
  if (!c) return <NotFoundView />;
  if (!canSee(user, c.ownerId)) {
    return (
      <EmptyState
        icon={
          <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-warm-bg text-warm">
            <Lock size={28} />
          </span>
        }
        title="This account belongs to someone else"
        body={`${c.name} is managed by ${c.owner}.`}
        action={
          <Link href="/customers" className={btnPrimary}>
            Back to customers
          </Link>
        }
      />
    );
  }

  const open = (d: Dialog) => {
    setN((x) => x + 1);
    setDialog(d);
  };
  const close = () => setDialog(null);

  const editable = canEdit(user, c.ownerId);
  const lead = c.leadId ? crm.leads.find((l) => l.id === c.leadId) : crm.leads.find((l) => l.customerId === c.id);
  const activities = crm.activities.filter((a) => a.customerId === c.id || (lead && a.leadId === lead.id));
  const deals = crm.deals.filter((d) => d.customerId === c.id).sort((a, b) => Number(OPEN_STAGES.includes(b.stage)) - Number(OPEN_STAGES.includes(a.stage)));
  const openDeals = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const tasks = crm.tasks.filter((t) => !t.done && (t.customerId === c.id || (lead && t.leadId === lead.id))).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const lastContact = activities.find((a) => ["call", "email", "meeting"].includes(a.kind));
  const primary = c.contacts.find((p) => p.primary) ?? c.contacts[0];
  const sinceLabel = Number.isNaN(Date.parse(c.since)) ? c.since : formatDate(new Date(c.since).toISOString());

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[13px] text-slate-500">
        <Link href="/customers" className="font-semibold text-primary">
          Customers
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-navy">{c.name}</span>
      </nav>

      <section className={`${card} flex flex-col gap-5 px-4 py-5 sm:p-6`}>
        <div className="flex flex-wrap justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-2xl bg-avatar text-[19px] font-extrabold text-avatar-text ring-1 ring-ok-border">{c.initials}</span>
            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold tracking-tight sm:text-2xl">{c.name}</h1>
              <div className="text-[13.5px] text-slate-500">{[c.industry, c.city, c.website].filter(Boolean).join(" · ")}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={healthTone[c.health]}>{c.health}</Badge>
                <Badge tone="neutral">Customer since {sinceLabel}</Badge>
                <Badge tone="cold">Owner: {c.owner}</Badge>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto [&>*]:flex-auto [&>*]:whitespace-nowrap sm:[&>*]:flex-none">
            <button type="button" className={btnOutline} onClick={() => open({ kind: "log", activity: "call" })}>
              Log call
            </button>
            <button type="button" className={btnOutline} onClick={() => open({ kind: "log", activity: "email" })}>
              Send email
            </button>
            {editable && (
              <button type="button" className={btnOutline} onClick={() => open({ kind: "edit" })}>
                Edit
              </button>
            )}
            <button type="button" className={btnPrimary} onClick={() => open({ kind: "deal" })}>
              + New deal
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-4 border-t border-row-line pt-[18px] lg:grid-cols-4">
          {[
            ["Lifetime value", formatCurrency(c.lifetimeValue)],
            ["Open deals", `${openDeals.length + c.legacyOpenDeals}${openDeals.length ? ` · ${formatCurrency(openDeals.reduce((s, d) => s + d.value, 0))}` : ""}`],
            ["Open tasks", String(tasks.length)],
            ["Last contact", lastContact ? timeAgo(lastContact.at) : "No contact yet"],
          ].map(([k, v], i) => (
            <div key={k} className={`flex flex-col gap-1 ${i % 2 === 1 ? "border-l border-row-line pl-5" : ""} ${i === 2 ? "lg:border-l lg:pl-5" : ""}`}>
              <span className="text-[13px] text-slate-500">{k}</span>
              <b className="text-lg sm:text-[22px]">{v}</b>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[999_1_520px]">
          <ActivityFeed
            activities={activities}
            placeholder={`Add a note about ${c.name}. Mention a teammate with @`}
            onAddNote={async (text) => {
              await logActivity({ kind: "note", title: text, meta: user.short, customerId: c.id });
              toast("Note saved");
            }}
          />
        </div>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <section className={`${card} flex flex-col gap-3.5 p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">Contacts</h2>
              {editable && (
                <button type="button" onClick={() => open({ kind: "contact" })} className="text-[13px] font-bold text-primary">
                  + Add
                </button>
              )}
            </div>
            {c.contacts.map((p) => (
              <div key={`${p.name}${p.email}`} className="flex items-start gap-3">
                <Avatar name={p.name} size={34} />
                {/* One column, so a long email never squeezes the name. */}
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px]">{p.name}</b>
                  <div className="truncate text-xs text-slate-500">
                    {p.title || "Contact"}
                    {p === primary ? " · Primary" : ""}
                  </div>
                  {(p.email || p.phone) && (
                    <div className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-xs">
                      {p.email && (
                        <a href={`mailto:${p.email}`} className="min-w-0 max-w-full truncate text-primary">
                          {p.email}
                        </a>
                      )}
                      {p.phone && <span className="text-slate-500">{p.phone}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>

          <section className={`${card} flex flex-col gap-3 p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">Deals</h2>
              <Link href="/pipeline" className="text-[13px] font-bold text-primary">
                View in pipeline
              </Link>
            </div>
            {deals.length === 0 && <div className="text-sm text-slate-500">No deals yet.</div>}
            {deals.map((d) => {
              const isOpen = OPEN_STAGES.includes(d.stage);
              return (
                <button key={d.id} type="button" onClick={() => open({ kind: "deal", deal: d })} className="flex flex-col gap-2 rounded-xl border border-line px-3.5 py-3 text-left hover:border-edge-strong">
                  <div className="flex justify-between gap-2">
                    <b className="text-[13.5px]">{d.title}</b>
                    <Badge tone={d.stage === "Won" ? "ok" : d.stage === "Lost" ? "neutral" : "cold"}>{d.stage}</Badge>
                  </div>
                  {isOpen && (
                    <div className="h-1.5 rounded-full bg-subtle">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${d.probability}%` }} />
                    </div>
                  )}
                  <div className="flex justify-between text-[12.5px] text-slate-500">
                    <span>
                      {formatCurrency(d.value)}
                      {isOpen ? ` · ${d.probability}%` : ""}
                    </span>
                    <span>{isOpen ? `Expected ${formatDate(d.closeDate)}` : `Closed ${formatDate(d.closedAt ?? d.closeDate)}`}</span>
                  </div>
                </button>
              );
            })}
          </section>

          <section className={`${card} flex flex-col gap-3 p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold">Open tasks</h2>
              <button type="button" onClick={() => open({ kind: "task" })} className="text-[13px] font-bold text-primary">
                + Add task
              </button>
            </div>
            {tasks.length === 0 && <div className="text-sm text-slate-500">No open tasks.</div>}
            {tasks.map((t) => {
              const overdue = new Date(t.dueAt).getTime() < now;
              return (
                <label key={t.id} className="flex gap-2.5 text-[13.5px]">
                  <input
                    type="checkbox"
                    onChange={() => {
                      // The box ticks at once; the message waits until the server has saved it.
                      toggleTask(t.id)
                        .then(() => toast("Task completed", { action: { label: "Undo", onClick: () => void toggleTask(t.id).catch(showError) } }))
                        .catch(showError);
                    }}
                    className="mt-0.5 h-[17px] w-[17px] shrink-0 accent-primary"
                  />
                  <span>
                    <b className="block">{t.title}</b>
                    <span className={`text-xs ${overdue ? "font-semibold text-hot" : "text-slate-500"}`}>
                      {overdue ? "Overdue · " : ""}
                      {formatDue(t.dueAt)} · {t.owner}
                    </span>
                  </span>
                </label>
              );
            })}
          </section>

          <section className={`${card} flex flex-col gap-2.5 p-5`}>
            <h2 className="text-[15px] font-extrabold">Linked lead</h2>
            {lead ? (
              <Link href={`/leads/${lead.id}`} className="flex items-center gap-3">
                <Avatar initials={lead.initials} size={34} />
                <span className="min-w-0 flex-1">
                  <b className="block text-[13.5px]">{lead.name}</b>
                  <span className="text-xs text-slate-500">
                    {lead.status === "Converted" && lead.stageDates[3] ? `Converted ${formatDate(lead.stageDates[3])}` : lead.status} from {lead.source} · score {lead.score}
                  </span>
                </span>
                <span className="text-[13px] font-bold text-primary">Open</span>
              </Link>
            ) : (
              <span className="text-sm text-slate-500">This customer was added directly, not converted from a lead.</span>
            )}
          </section>

          {can(user, "delete") && (
            <button type="button" onClick={() => open({ kind: "delete" })} className="self-start text-[13px] font-bold text-hot hover:underline">
              Delete this customer
            </button>
          )}
        </div>
      </div>

      {dialog?.kind === "edit" && <CustomerForm key={`e${n}`} open onClose={close} customer={c} />}
      {dialog?.kind === "log" && (
        <LogActivityDialog
          key={`l${n}`}
          open
          onClose={close}
          initialKind={dialog.activity}
          target={{ name: primary?.name ?? c.name, company: c.name, customerId: c.id, email: primary?.email }}
        />
      )}
      {dialog?.kind === "deal" && <DealForm key={`d${n}`} open onClose={close} deal={dialog.deal} defaults={{ customerId: c.id }} />}
      {dialog?.kind === "task" && <TaskForm key={`t${n}`} open onClose={close} defaults={{ customerId: c.id, title: `Check in with ${primary?.name ?? c.name}` }} />}
      {dialog?.kind === "contact" && <AddContactDialog key={`c${n}`} open onClose={close} customerId={c.id} />}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onClose={close}
        title={`Delete ${c.name}?`}
        body="Their open tasks are deleted. Their deals stay in the pipeline and reports, but are no longer linked to a customer. This can’t be undone, and the deletion is recorded in the audit log."
        confirmLabel="Delete customer"
        onConfirm={async () => {
          await deleteCustomer(c.id);
          toast(`${c.name} deleted`);
          router.push("/customers");
        }}
      />
    </>
  );
}
