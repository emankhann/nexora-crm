"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { SelectField, TextField, type Errors } from "@/components/ui/Field";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { errorMessage, formErrors } from "@/lib/api";
import { DEAL_STAGES, LOST_REASONS, OPEN_STAGES, STAGE_PROBABILITY, createDeal, deleteDeal, moveDeal, updateDeal, useCrm, type DealInput } from "@/lib/crm-store";
import { can, canEdit, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnGhostDanger, btnOutline, btnPrimary, inputCls, sectionLabel } from "@/lib/ui";
import { getOwnerOptions, NO_OWNER, ownerOption } from "@/lib/users";
import { daysFromNow, formatCurrency, formatDate, fromInputs, parseMoney, timeAgo, toDateInput } from "@/lib/utils";
import type { DealRecord, DealStage, DealTag } from "@/types";

type Field = "title" | "company" | "value" | "closeDate";

/** Server validation errors for the fields that show messages; anything else is shown as a toast. */
const SHOWN_FIELDS = { title: "title", company: "company", value: "value", expected_close_date: "closeDate" } as const;

const tagTone = { Hot: "hot", Warm: "warm", New: "cold", Cold: "cold" } as const;

/** Small dialog that asks why a deal was lost. */
export function LostReasonDialog({ open, onClose, deal }: { open: boolean; onClose: () => void; deal: DealRecord }) {
  const user = useSessionUser();
  const toast = useToast();
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);
  const showError = useErrorToast();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Mark ${deal.title} as lost`}
      description="The reason shows up in the pipeline report, so the team can learn from it."
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-xl bg-danger px-[18px] text-[13.5px] font-bold text-white disabled:opacity-60"
            disabled={saving}
            onClick={async () => {
              if (!user || saving) return;
              setSaving(true);
              try {
                await moveDeal(deal.id, "Lost", reason === "Other" ? other.trim() || "Other" : reason);
                toast(`${deal.title} marked as lost`);
                onClose();
              } catch (err) {
                showError(err);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Mark as lost"}
          </button>
        </div>
      }
    >
      <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-1.5">
        {LOST_REASONS.map((r) => (
          <label key={r} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-semibold ${reason === r ? "border-primary bg-primary-soft" : "border-line"}`}>
            <input type="radio" name="lost" checked={reason === r} onChange={() => setReason(r)} className="accent-primary" />
            {r}
          </label>
        ))}
        {reason === "Other" && <input aria-label="Other reason" value={other} onChange={(e) => setOther(e.target.value)} placeholder="What happened?" className={`${inputCls} mt-1`} />}
      </div>
    </Modal>
  );
}

export type DealDefaults = { customerId?: string | null; leadId?: string | null; stage?: DealStage };

/**
 * New deal (centered) or deal detail/edit (slide-over) in one component.
 */
export default function DealForm({
  open,
  onClose,
  deal,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  deal?: DealRecord | null;
  defaults?: DealDefaults;
}) {
  const crm = useCrm();
  const user = useSessionUser();
  const toast = useToast();
  const editing = Boolean(deal);

  const defaultCustomer = defaults?.customerId ? crm?.customers.find((c) => c.id === defaults.customerId) : undefined;
  const defaultLead = defaults?.leadId ? crm?.leads.find((l) => l.id === defaults.leadId) : undefined;
  const initialLink = deal?.customerId ? `customer:${deal.customerId}` : deal?.leadId ? `lead:${deal.leadId}` : defaultCustomer ? `customer:${defaultCustomer.id}` : defaultLead ? `lead:${defaultLead.id}` : "";

  const [title, setTitle] = useState(deal?.title ?? "");
  const [link, setLink] = useState(initialLink);
  const [company, setCompany] = useState(deal?.company ?? defaultCustomer?.name ?? defaultLead?.company ?? "");
  const [value, setValue] = useState(deal ? String(deal.value) : "");
  const [stage, setStage] = useState<DealStage>(deal?.stage ?? defaults?.stage ?? "New");
  const [probability, setProbability] = useState(deal?.probability ?? STAGE_PROBABILITY[defaults?.stage ?? "New"]);
  const [closeDate, setCloseDate] = useState(toDateInput(deal?.closeDate ?? daysFromNow(30)));
  const [ownerId, setOwnerId] = useState(deal?.ownerId ?? user?.id ?? NO_OWNER);
  const [tag, setTag] = useState<DealTag>(deal?.tag ?? "Warm");
  const [next, setNext] = useState(deal?.next ?? "");
  const [errors, setErrors] = useState<Errors<Field>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const showError = useErrorToast();

  if (!crm || !user) return null;
  const readOnly = deal ? !canEdit(user, deal.ownerId) : false;

  function onLinkChange(next: string) {
    setLink(next);
    if (!crm) return;
    const [kind, id] = next.split(":");
    const name = kind === "customer" ? crm.customers.find((c) => c.id === id)?.name : kind === "lead" ? crm.leads.find((l) => l.id === id)?.company : undefined;
    if (name) setCompany(name);
  }

  function onStageChange(s: DealStage) {
    setStage(s);
    setProbability(STAGE_PROBABILITY[s]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || saving) return;
    const amount = parseMoney(value);
    const errs: Errors<Field> = {};
    if (!title.trim()) errs.title = "Name the deal.";
    if (!company.trim()) errs.company = "Enter the company or pick a customer.";
    if (!Number.isFinite(amount) || amount <= 0) errs.value = "Enter a value above 0.";
    if (!closeDate) errs.closeDate = "Pick an expected close date.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const [kind, id] = link.split(":");
    const input: DealInput = {
      title: title.trim(),
      company: company.trim(),
      value: amount,
      stage,
      probability: Math.max(0, Math.min(100, probability)),
      closeDate: fromInputs(closeDate, "17:00"),
      ownerId,
      tag,
      next: next.trim(),
      leadId: kind === "lead" ? id : (deal?.leadId ?? null),
      customerId: kind === "customer" ? id : (deal?.customerId ?? null),
    };

    setSaving(true);
    try {
      if (deal) {
        if (stage === "Lost" && deal.stage !== "Lost") {
          // Ask for a reason first; save the other fields with the old stage.
          await updateDeal(deal.id, { ...input, stage: deal.stage });
          setLostOpen(true);
          return;
        }
        await updateDeal(deal.id, input);
        toast(stage !== deal.stage ? `${input.title} moved to ${stage}` : "Deal saved");
      } else {
        await createDeal(input);
        toast(`${input.title} added to ${stage}`);
      }
      onClose();
    } catch (err) {
      const fields = formErrors(err, SHOWN_FIELDS);
      if (fields) setErrors(fields);
      else toast(errorMessage(err), { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const ownerChoices = can(user, "reassign") ? getOwnerOptions({ unassigned: false }) : [ownerOption(ownerId)];
  const leadOptions = crm.leads.filter((l) => canSee(user, l.ownerId) && l.status !== "Converted");
  const customerOptions = crm.customers.filter((c) => canSee(user, c.ownerId));
  const activities = deal ? crm.activities.filter((a) => a.dealId === deal.id).slice(0, 5) : [];
  const stageIdx = DEAL_STAGES.indexOf(deal?.stage ?? stage);
  const weighted = Math.round(((Number.isFinite(parseMoney(value)) ? parseMoney(value) : 0) * probability) / 100);

  return (
    <>
      <Modal
        open={open && !lostOpen}
        onClose={onClose}
        variant={editing ? "right" : "center"}
        size="md"
        title={editing && deal ? deal.title : "New deal"}
        description={
          editing && deal ? (
            <span className="flex flex-wrap items-center gap-2">
              {deal.customerId ? (
                <Link href={`/customers/${deal.customerId}`} className="font-semibold text-primary">
                  {deal.company}
                </Link>
              ) : deal.leadId ? (
                <Link href={`/leads/${deal.leadId}`} className="font-semibold text-primary">
                  {deal.company}
                </Link>
              ) : (
                deal.company
              )}
              <Badge tone={tagTone[deal.tag]}>{deal.tag}</Badge>
            </span>
          ) : (
            "Link it to a customer or lead so it shows on their page."
          )
        }
        footer={
          <>
            {editing && can(user, "delete") ? (
              <button type="button" className={btnGhostDanger} onClick={() => setConfirmDelete(true)}>
                Delete deal
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2.5">
              <button type="button" className={btnOutline} onClick={onClose}>
                {readOnly ? "Close" : "Cancel"}
              </button>
              {!readOnly && (
                <button type="submit" form="deal-form" className={btnPrimary} disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Create deal"}
                </button>
              )}
            </div>
          </>
        }
      >
        {editing && deal && (
          <div className="mb-5 flex flex-col gap-2">
            <div className="flex items-center gap-1.5" aria-label={`Stage: ${deal.stage}`}>
              {["New", "Contacted", "Qualified", "Proposal", deal.stage === "Lost" ? "Lost" : "Won"].map((s, i, arr) => {
                const idx = deal.stage === "Lost" ? (s === "Lost" ? 4 : -1) : stageIdx;
                const done = i < idx || (deal.stage === "Won" && i === 4);
                const current = i === idx && deal.stage !== "Won";
                return (
                  <div key={s} className="flex flex-1 items-center gap-1.5 last:flex-none">
                    <span
                      className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${
                        s === "Lost" ? "bg-hot-bg text-hot" : done ? "bg-primary text-ink" : current ? "border-2 border-primary bg-surface text-primary" : "border border-edge-strong bg-muted text-slate-500"
                      }`}
                    >
                      {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                    </span>
                    {i < arr.length - 1 && <span className={`h-[3px] flex-1 rounded-full ${i < idx ? "bg-primary" : "bg-line"}`} />}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[11.5px] font-bold text-slate-600">
              <span>New</span>
              <span>Contacted</span>
              <span>Qualified</span>
              <span>Proposal</span>
              <span>{deal.stage === "Lost" ? "Lost" : "Won"}</span>
            </div>
            {deal.stage === "Lost" && deal.lostReason && <div className="text-xs font-semibold text-hot">Lost: {deal.lostReason}</div>}
          </div>
        )}

        <form id="deal-form" onSubmit={submit} noValidate>
          <fieldset disabled={readOnly} className="flex flex-col gap-4">
            <TextField label="Deal name" required value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} placeholder="e.g. Website redesign" />
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-[7px]">
                <label htmlFor="deal-link" className="text-[13px] font-bold text-slate-800">
                  Customer or lead
                </label>
                <select id="deal-link" value={link} onChange={(e) => onLinkChange(e.target.value)} className={inputCls}>
                  <option value="">Not linked</option>
                  <optgroup label="Customers">
                    {customerOptions.map((c) => (
                      <option key={c.id} value={`customer:${c.id}`}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Leads">
                    {leadOptions.map((l) => (
                      <option key={l.id} value={`lead:${l.id}`}>
                        {l.name} · {l.company}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <TextField label="Company" required value={company} onChange={(e) => setCompany(e.target.value)} error={errors.company} />
              <TextField label="Value (USD)" required inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} error={errors.value} placeholder="12,500" />
              <SelectField label="Stage" value={stage} onChange={(e) => onStageChange(e.target.value as DealStage)} options={editing ? DEAL_STAGES : OPEN_STAGES} />
              <TextField label="Expected close date" required type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} error={errors.closeDate} />
              <SelectField label="Owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} options={ownerChoices} />
              <SelectField label="Temperature" value={tag} onChange={(e) => setTag(e.target.value as DealTag)} options={["Hot", "Warm", "New", "Cold"]} />
              <TextField label="Next step" value={next} onChange={(e) => setNext(e.target.value)} placeholder="e.g. Send the proposal" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[13px] font-bold">
                <label htmlFor="deal-prob">Probability to close</label>
                <span className="text-primary">{probability}%</span>
              </div>
              <input id="deal-prob" type="range" min={0} max={100} step={5} value={probability} onChange={(e) => setProbability(Number(e.target.value))} className="w-full accent-primary" />
              <span className="text-xs text-slate-500">
                Weighted value: {formatCurrency(weighted)}. Set from the stage; change it if you know better. This doesn’t move the deal to another stage; moving it resets this to the new stage’s default.
              </span>
            </div>
          </fieldset>
        </form>

        {editing && deal && !readOnly && OPEN_STAGES.includes(deal.stage) && (
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-ok-border bg-primary-soft text-[13.5px] font-bold text-ok"
              onClick={() => {
                moveDeal(deal.id, "Won")
                  .then(() => toast(`${deal.title} won · ${formatCurrency(deal.value)}`))
                  .catch(showError);
                onClose();
              }}
            >
              Mark as won
            </button>
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-xl border border-hot-border bg-surface text-[13.5px] font-bold text-hot" onClick={() => setLostOpen(true)}>
              Mark as lost
            </button>
          </div>
        )}

        {editing && (
          <div className="mt-6 flex flex-col gap-3">
            <div className={sectionLabel}>RECENT ACTIVITY</div>
            {activities.length === 0 && <div className="text-sm text-slate-500">No activity on this deal yet.</div>}
            {activities.map((a) => (
              <div key={a.id} className="flex gap-2.5 text-[13px]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span>
                  <b>{a.title}</b>
                  <span className="block text-xs text-slate-500">
                    {timeAgo(a.at)} · {a.meta}
                  </span>
                </span>
              </div>
            ))}
            {deal && deal.closedAt && <div className="text-xs text-slate-500">Closed {formatDate(deal.closedAt)}</div>}
          </div>
        )}
      </Modal>

      {deal && lostOpen && <LostReasonDialog open onClose={() => { setLostOpen(false); onClose(); }} deal={deal} />}

      {deal && (
        <Modal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          size="sm"
          alert
          title={`Delete ${deal.title}?`}
          footer={
            <div className="ml-auto flex gap-2.5">
              <button type="button" className={btnOutline} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-xl bg-danger px-[18px] text-[13.5px] font-bold text-white"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await deleteDeal(deal.id);
                    toast(`${deal.title} deleted`);
                    setConfirmDelete(false);
                    onClose();
                  } catch (err) {
                    showError(err);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Deleting…" : "Delete deal"}
              </button>
            </div>
          }
        >
          <p className="text-[13.5px] leading-relaxed text-slate-600">The deal is removed from the pipeline and reports. This can’t be undone.</p>
        </Modal>
      )}
    </>
  );
}
