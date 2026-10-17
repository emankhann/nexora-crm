"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { SelectField, TextField, type Errors } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { INDUSTRIES, OPEN_STAGES, convertLead, useCrm } from "@/lib/crm-store";
import { can } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary, sectionLabel } from "@/lib/ui";
import { getOwnerOptions } from "@/lib/users";
import { daysFromNow, fromInputs, parseMoney, toDateInput } from "@/lib/utils";
import type { DealStage, LeadRecord } from "@/types";

type Field = "existing" | "dealTitle" | "dealValue" | "closeDate";

export default function ConvertLeadDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: LeadRecord }) {
  const crm = useCrm();
  const user = useSessionUser();
  const toast = useToast();
  const router = useRouter();

  const existingDeal = crm?.deals.find((d) => d.leadId === lead.id && OPEN_STAGES.includes(d.stage));
  const match = crm?.customers.find((c) => c.name.toLowerCase() === lead.company.toLowerCase());

  const [mode, setMode] = useState<"new" | "existing">(match ? "existing" : "new");
  const [existingId, setExistingId] = useState(match?.id ?? "");
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [owner, setOwner] = useState(lead.owner === "Unassigned" ? (user?.short ?? "Unassigned") : lead.owner);
  const [createDeal, setCreateDeal] = useState(!existingDeal);
  const [dealTitle, setDealTitle] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [stage, setStage] = useState<DealStage>("Proposal");
  const [closeDate, setCloseDate] = useState(toDateInput(daysFromNow(14)));
  const [errors, setErrors] = useState<Errors<Field>>({});

  if (!crm || !user) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const errs: Errors<Field> = {};
    if (mode === "existing" && !existingId) errs.existing = "Pick a customer.";
    const value = parseMoney(dealValue);
    if (createDeal) {
      if (!dealTitle.trim()) errs.dealTitle = "Name the deal.";
      if (!Number.isFinite(value) || value <= 0) errs.dealValue = "Enter a value above 0.";
      if (!closeDate) errs.closeDate = "Pick a date.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const customerId = convertLead(
      lead.id,
      {
        mode,
        existingCustomerId: existingId,
        industry,
        owner,
        createDeal,
        deal: { title: dealTitle.trim(), value, stage, closeDate: fromInputs(closeDate, "17:00") },
      },
      user
    );
    onClose();
    if (customerId) {
      toast(`${lead.name} is now a customer`, { action: { label: "Open", onClick: () => router.push(`/customers/${customerId}`) } });
    }
  }

  const canPickOwner = can(user, "reassign");

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Convert ${lead.name} to a customer`}
      description="Notes, calls, emails, deals and open tasks move with them."
      icon={
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-primary-soft text-ok">
          <ArrowRight size={20} />
        </span>
      }
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="convert-form" className={btnPrimary}>
            Convert to customer
          </button>
        </div>
      }
    >
      <form id="convert-form" onSubmit={submit} noValidate className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-2.5">
          <div className={sectionLabel}>CUSTOMER ACCOUNT</div>
          <div role="radiogroup" aria-label="Customer account" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {(["new", "existing"] as const).map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer gap-2.5 rounded-xl p-3 text-[13.5px] ${mode === m ? "border-[1.5px] border-primary bg-primary-soft" : "border border-edge"}`}
              >
                <input type="radio" name="acct" checked={mode === m} onChange={() => setMode(m)} className="mt-0.5 accent-primary" />
                <span>
                  <b className="block">{m === "new" ? "Create new customer" : "Add to existing"}</b>
                  <span className="text-xs text-slate-500">
                    {m === "new" ? lead.company : match ? `Found: ${match.name}` : `Pick from ${crm.customers.length} customers`}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {mode === "existing" ? (
              <SelectField
                label="Customer"
                required
                value={existingId}
                onChange={(e) => setExistingId(e.target.value)}
                error={errors.existing}
                options={[{ value: "", label: "Choose…" }, ...crm.customers.map((c) => ({ value: c.id, label: c.name }))]}
              />
            ) : (
              <SelectField label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} options={INDUSTRIES} />
            )}
            <SelectField
              label="Account owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              options={canPickOwner ? getOwnerOptions().filter((o) => o !== "Unassigned") : [owner]}
              disabled={!canPickOwner}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3.5 rounded-[14px] border border-line px-4 py-3.5">
          <label className="flex items-center justify-between gap-3 text-sm font-bold">
            {existingDeal ? `Also create another deal (“${existingDeal.title}” moves across)` : "Also create a deal"}
            <input
              type="checkbox"
              role="switch"
              checked={createDeal}
              onChange={(e) => setCreateDeal(e.target.checked)}
              className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-edge-strong transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-surface before:transition-transform checked:bg-primary checked:before:translate-x-[18px]"
            />
          </label>
          {createDeal && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[2fr_1fr]">
              <TextField label="Deal name" required value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} error={errors.dealTitle} placeholder="e.g. Fleet tracking portal" />
              <TextField label="Value (USD)" required inputMode="decimal" value={dealValue} onChange={(e) => setDealValue(e.target.value)} error={errors.dealValue} placeholder="12,500" />
              <SelectField label="Stage" value={stage} onChange={(e) => setStage(e.target.value as DealStage)} options={["New", "Contacted", "Qualified", "Proposal", "Won"]} />
              <TextField label="Expected close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} error={errors.closeDate} />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
