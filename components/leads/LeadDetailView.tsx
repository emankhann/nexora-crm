"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import StageStepper from "@/components/leads/StageStepper";
import ActivityFeed from "@/components/activity/ActivityFeed";
import LeadForm from "@/components/leads/LeadForm";
import LogActivityDialog, { type ActivityKindChoice } from "@/components/leads/LogActivityDialog";
import ConvertLeadDialog from "@/components/leads/ConvertLeadDialog";
import { AssignOwnerDialog } from "@/components/leads/BulkDialogs";
import TaskForm from "@/components/tasks/TaskForm";
import NotFoundView from "@/components/ui/NotFoundView";
import { statusTone } from "@/components/leads/LeadsTable";
import { deleteLeads, logActivity, toggleTask, useCrm } from "@/lib/crm-store";
import { can, canEdit, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { useNow } from "@/lib/use-now";
import { btnOutline, btnPrimary, card } from "@/lib/ui";
import { formatCurrency, formatDate, formatDue, scoreTier } from "@/lib/utils";

const stageIndex = { New: 0, Contacted: 1, Qualified: 2, Unqualified: 0, Converted: 4 } as const;

type DialogState =
  | null
  | { kind: "edit" }
  | { kind: "log"; activity: ActivityKindChoice }
  | { kind: "convert" }
  | { kind: "assign" }
  | { kind: "task" }
  | { kind: "delete" };

export default function LeadDetailView({ id }: { id: string }) {
  const crm = useCrm();
  const now = useNow();
  const user = useSessionUser();
  const toast = useToast();
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [n, setN] = useState(0);

  if (!crm || !user) return null;
  const lead = crm.leads.find((l) => l.id === id);
  if (!lead) return <NotFoundView />;

  if (!canSee(user, lead.owner)) {
    return (
      <EmptyState
        icon={
          <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-[#261E0C] text-[#F6C866]">
            <Lock size={28} />
          </span>
        }
        title="This lead belongs to someone else"
        body={`${lead.name} is assigned to ${lead.owner}. Sales reps can only open their own leads.`}
        action={
          <Link href="/leads" className={btnPrimary}>
            Back to my leads
          </Link>
        }
      />
    );
  }

  const open = (d: DialogState) => {
    setN((x) => x + 1);
    setDialog(d);
  };
  const close = () => setDialog(null);

  const editable = canEdit(user, lead.owner);
  const tier = scoreTier(lead.score);
  const maxPoints = Math.max(1, ...lead.factors.map((f) => f.points));
  const activities = crm.activities.filter((a) => a.leadId === lead.id);
  const deals = crm.deals.filter((d) => d.leadId === lead.id);
  const tasks = crm.tasks.filter((t) => t.leadId === lead.id && !t.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const customer = lead.customerId ? crm.customers.find((c) => c.id === lead.customerId) : null;
  const converted = lead.status === "Converted";

  const details: [string, string][] = [
    ["Email", lead.email],
    ["Phone", lead.phone || "Not added"],
    ["Company", lead.company],
    ["Company size", lead.companySize],
    ["Source", lead.source],
    ["Owner", lead.owner],
    ["Created", formatDate(lead.createdAt)],
  ];

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[13px] text-slate-500">
        <Link href="/leads" className="font-semibold text-primary">
          Leads
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-navy">{lead.name}</span>
      </nav>

      <div className={`${card} flex flex-col gap-6 px-4 py-5 sm:px-7 sm:py-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <Avatar initials={lead.initials} size={64} />
            <div className="min-w-0">
              <h1 className="text-[22px] font-extrabold tracking-tight sm:text-[26px]">{lead.name}</h1>
              <div className="mt-0.5 text-sm text-slate-500">
                {lead.title ? `${lead.title} at ` : ""}
                {lead.company}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={tier.key}>
                  {tier.label} {lead.score}
                </Badge>
                <Badge tone={statusTone[lead.status]}>{lead.status}</Badge>
                <Badge tone="neutral">{lead.source}</Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {editable && (
              <button type="button" className={btnOutline} onClick={() => open({ kind: "edit" })}>
                Edit
              </button>
            )}
            <button type="button" className={btnOutline} onClick={() => open({ kind: "log", activity: "call" })}>
              Log call
            </button>
            <button type="button" className={btnOutline} onClick={() => open({ kind: "log", activity: "email" })}>
              Send email
            </button>
            {converted && customer ? (
              <Link href={`/customers/${customer.id}`} className={btnPrimary}>
                View customer
              </Link>
            ) : (
              editable && (
                <button type="button" className={btnPrimary} onClick={() => open({ kind: "convert" })}>
                  Convert to customer
                </button>
              )
            )}
          </div>
        </div>
        <StageStepper current={stageIndex[lead.status]} dates={lead.stageDates} />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
          <div className={`${card} flex flex-col gap-3.5 px-4 py-5 sm:px-6`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">Why this lead scores {lead.score}</h2>
              <span className="text-xs text-slate-500">
                {lead.autoScore ? "Worked out from Nexora’s scoring rules" : "Rules are set by admins and recalculate on every interaction"}
              </span>
            </div>
            {lead.factors.length === 0 && <div className="py-4 text-sm text-slate-500">No scoring signals recorded yet.</div>}
            {lead.factors.map((f) => (
              <div key={f.label} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-[13px] font-semibold">
                  <span>{f.label}</span>
                  <span className="text-primary">+{f.points}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1A211D]">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(f.points / maxPoints) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          <ActivityFeed
            activities={activities}
            placeholder="Write a note about this lead. Mention a teammate with @"
            onAddNote={(text) => {
              logActivity({ kind: "note", title: text, meta: user.short, leadId: lead.id, customerId: lead.customerId ?? undefined }, user);
              toast("Note saved");
            }}
          />
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <div className={`${card} flex flex-col gap-3.5 px-[22px] py-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Contact details</h2>
              {can(user, "reassign") && (
                <button type="button" onClick={() => open({ kind: "assign" })} className="text-[13px] font-semibold text-primary">
                  Change owner
                </button>
              )}
            </div>
            {details.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 text-[13px]">
                <span className="shrink-0 text-slate-500">{k}</span>
                <span className="min-w-0 truncate text-right font-bold">{v}</span>
              </div>
            ))}
          </div>

          <div className={`${card} flex flex-col gap-3.5 px-[22px] py-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">{deals.length > 1 ? "Linked deals" : "Linked deal"}</h2>
              {deals.length > 0 && (
                <Link href="/pipeline" className="text-[13px] font-semibold text-primary">
                  Pipeline
                </Link>
              )}
            </div>
            {deals.length === 0 && <div className="text-sm text-slate-500">No deal linked to this lead yet. Converting can create one.</div>}
            {deals.map((d) => (
              <Link key={d.id} href={`/pipeline?deal=${d.id}`} className="flex flex-col gap-2.5 rounded-xl bg-[#171C19] p-4 hover:bg-[#1A211D]">
                <div className="text-[13.5px] font-bold">{d.title}</div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-extrabold tracking-tight">{formatCurrency(d.value)}</span>
                  <Badge tone={d.stage === "Won" ? "ok" : d.stage === "Lost" ? "neutral" : "cold"}>{d.stage}</Badge>
                </div>
                <div className="h-1.5 rounded-full bg-[#26302A]">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${d.probability}%` }} />
                </div>
                <div className="text-xs text-slate-500">
                  {d.probability}% chance to close · expected {formatDate(d.closeDate)}
                </div>
              </Link>
            ))}
          </div>

          <div className={`${card} flex flex-col gap-3.5 px-[22px] py-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Open tasks</h2>
              <button type="button" onClick={() => open({ kind: "task" })} className="text-[13px] font-semibold text-primary">
                + Add task
              </button>
            </div>
            {tasks.length === 0 && <div className="text-sm text-slate-500">No open tasks.</div>}
            {tasks.map((t) => {
              const overdue = new Date(t.dueAt).getTime() < now;
              return (
                <label key={t.id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Complete task: ${t.title}`}
                    onChange={() => {
                      toggleTask(t.id, user);
                      toast("Task completed", { action: { label: "Undo", onClick: () => toggleTask(t.id, user) } });
                    }}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-[13.5px] font-semibold">{t.title}</span>
                    <span className={`mt-0.5 block text-xs ${overdue ? "font-semibold text-[#FF8F84]" : "text-slate-500"}`}>
                      {overdue ? "Overdue · " : ""}
                      {formatDue(t.dueAt)} · {t.owner}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {can(user, "delete") && (
            <button type="button" onClick={() => open({ kind: "delete" })} className="self-start text-[13px] font-bold text-[#FF8F84] hover:underline">
              Delete this lead
            </button>
          )}
        </div>
      </div>

      {dialog?.kind === "edit" && (
        <LeadForm
          key={`e${n}`}
          open
          onClose={close}
          lead={lead}
          onDelete={can(user, "delete") ? () => open({ kind: "delete" }) : undefined}
        />
      )}
      {dialog?.kind === "log" && (
        <LogActivityDialog
          key={`l${n}`}
          open
          onClose={close}
          initialKind={dialog.activity}
          target={{ name: lead.name, company: lead.company, leadId: lead.id, customerId: lead.customerId ?? undefined, email: lead.email }}
        />
      )}
      {dialog?.kind === "convert" && <ConvertLeadDialog key={`c${n}`} open onClose={close} lead={lead} />}
      {dialog?.kind === "assign" && <AssignOwnerDialog key={`a${n}`} open onClose={close} leads={[lead]} />}
      {dialog?.kind === "task" && <TaskForm key={`t${n}`} open onClose={close} defaults={{ leadId: lead.id, title: `Follow up with ${lead.name}` }} />}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onClose={close}
        title={`Delete ${lead.name}?`}
        body="The lead will be removed with its notes and open tasks. This can’t be undone. The deletion is recorded in the audit log."
        confirmLabel="Delete lead"
        onConfirm={() => {
          deleteLeads([lead.id], user);
          toast(`${lead.name} deleted`);
          router.push("/leads");
        }}
      />
    </>
  );
}
