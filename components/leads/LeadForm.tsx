"use client";

import { useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import { SelectField, TextAreaField, TextField, type Errors } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { errorMessage, formErrors } from "@/lib/api";
import { COMPANY_SIZES, LEAD_FIELDS, LEAD_SOURCES, LEAD_STATUSES, createLead, updateLead, useCrm, type LeadInput } from "@/lib/crm-store";
import { can } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnGhostDanger, btnOutline, btnPrimary, sectionLabel } from "@/lib/ui";
import { getOwnerOptions, NO_OWNER, ownerOption } from "@/lib/users";
import { formatDate, isEmail, isPhone } from "@/lib/utils";
import type { LeadRecord, LeadSource, LeadStatus } from "@/types";

type Field = keyof LeadInput;

function blank(ownerId: string): LeadInput {
  return { name: "", email: "", phone: "", title: "", company: "", companySize: "51–200", source: "Website", status: "New", ownerId, notes: "" };
}

function fromLead(l: LeadRecord): LeadInput {
  return {
    name: l.name,
    email: l.email,
    phone: l.phone,
    title: l.title,
    company: l.company,
    companySize: l.companySize,
    source: l.source,
    status: l.status,
    ownerId: l.ownerId,
    notes: l.notes,
  };
}

/**
 * New lead (centered dialog) and Edit lead (slide-over), one form.
 * Parent renders it with a `key` so the fields reset each time it opens.
 */
export default function LeadForm({
  open,
  onClose,
  lead,
  onCreated,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  lead?: LeadRecord | null;
  onCreated?: (lead: LeadRecord) => void;
  onDelete?: () => void;
}) {
  const user = useSessionUser();
  const crm = useCrm();
  const toast = useToast();
  const editing = Boolean(lead);
  const [v, setV] = useState<LeadInput>(() => (lead ? fromLead(lead) : blank(user?.id ?? NO_OWNER)));
  const [errors, setErrors] = useState<Errors<Field>>({});
  const [another, setAnother] = useState(false);
  const [saving, setSaving] = useState(false);
  const converted = lead?.status === "Converted";

  const canReassign = can(user, "reassign");
  const set = <K extends keyof LeadInput>(k: K, value: LeadInput[K]) => setV((p) => ({ ...p, [k]: value }));

  function validate(): Errors<Field> {
    const e: Errors<Field> = {};
    if (!v.name.trim()) e.name = "Enter the lead’s name.";
    if (!v.company.trim()) e.company = "Enter the company.";
    if (!v.email.trim()) e.email = "Enter an email address.";
    else if (!isEmail(v.email)) e.email = "Enter a valid email, like name@company.com.";
    else if (crm?.leads.some((l) => l.email.toLowerCase() === v.email.trim().toLowerCase() && l.id !== lead?.id))
      e.email = "A lead with this email already exists.";
    if (!isPhone(v.phone)) e.phone = "Use digits, spaces, + ( ) or -.";
    return e;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!user || saving) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const clean: LeadInput = { ...v, name: v.name.trim(), email: v.email.trim().toLowerCase(), company: v.company.trim(), title: v.title.trim(), phone: v.phone.trim() };

    setSaving(true);
    try {
      if (lead) {
        await updateLead(lead.id, clean);
        toast("Lead saved");
        onClose();
        return;
      }
      const created = await createLead(clean);
      toast(`${created.name} added · score ${created.score}`);
      onCreated?.(created);
      if (another) {
        setV(blank(clean.ownerId));
        setErrors({});
      } else onClose();
    } catch (err) {
      const fields = formErrors(err, LEAD_FIELDS);
      if (fields) setErrors(fields);
      else toast(errorMessage(err), { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const formId = editing ? "edit-lead-form" : "new-lead-form";

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant={editing ? "right" : "center"}
      size="md"
      title={editing ? "Edit lead" : "New lead"}
      description={
        editing && lead
          ? `Created ${formatDate(lead.createdAt)} · owner ${lead.owner}`
          : "Fields marked * are required. The score is worked out after saving."
      }
      footer={
        <>
          {editing ? (
            onDelete ? (
              <button type="button" className={btnGhostDanger} onClick={onDelete}>
                Delete lead
              </button>
            ) : (
              <span />
            )
          ) : (
            <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
              <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="h-[17px] w-[17px] accent-primary" />
              Create another after saving
            </label>
          )}
          <div className="flex gap-2.5">
            <button type="button" className={btnOutline} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" form={formId} className={btnPrimary} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Save lead"}
            </button>
          </div>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        {editing && <div className={sectionLabel}>CONTACT</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Full name" required value={v.name} onChange={(e) => set("name", e.target.value)} error={errors.name} autoFocus placeholder="e.g. Sara Iqbal" />
          <TextField label="Company" required value={v.company} onChange={(e) => set("company", e.target.value)} error={errors.company} placeholder="e.g. Harbor Dental" />
          <TextField label="Email" required type="email" value={v.email} onChange={(e) => set("email", e.target.value)} error={errors.email} placeholder="name@company.com" />
          <TextField label="Phone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} placeholder="+92 300 000 0000" />
          <TextField label="Job title" value={v.title} onChange={(e) => set("title", e.target.value)} error={errors.title} placeholder="e.g. Operations Director" />
          <SelectField label="Company size" value={v.companySize} onChange={(e) => set("companySize", e.target.value)} options={COMPANY_SIZES} error={errors.companySize} />
        </div>
        {editing && <div className={sectionLabel}>QUALIFICATION</div>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField label="Source" required value={v.source} onChange={(e) => set("source", e.target.value as LeadSource)} options={LEAD_SOURCES} error={errors.source} />
          <SelectField
            label="Status"
            value={v.status}
            onChange={(e) => set("status", e.target.value as LeadStatus)}
            options={converted ? ["Converted"] : LEAD_STATUSES}
            disabled={converted}
            hint={converted ? "Converted leads keep this status." : undefined}
            error={errors.status}
          />
          <SelectField
            label="Owner"
            value={v.ownerId}
            onChange={(e) => set("ownerId", e.target.value)}
            options={canReassign ? getOwnerOptions() : [ownerOption(v.ownerId)]}
            disabled={!canReassign}
            hint={canReassign ? undefined : "Ask a manager to reassign."}
            error={errors.ownerId}
          />
        </div>
        {!editing && (
          <TextAreaField label="Notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} error={errors.notes} placeholder="How did you meet? What do they need?" />
        )}
      </form>
    </Modal>
  );
}
