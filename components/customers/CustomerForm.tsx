"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { SelectField, TextField, type Errors } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { COMPANY_SIZES, INDUSTRIES, createCustomer, updateCustomer, useCrm, type CustomerInput } from "@/lib/crm-store";
import { can } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary, sectionLabel } from "@/lib/ui";
import { getUsers } from "@/lib/users";
import { fromInputs, isEmail, isPhone, toDateInput } from "@/lib/utils";
import type { CustomerRecord, Health } from "@/types";

type Field = "name" | "industry" | "contactName" | "contactEmail" | "contactPhone" | "website";

export default function CustomerForm({ open, onClose, customer }: { open: boolean; onClose: () => void; customer?: CustomerRecord | null }) {
  const user = useSessionUser();
  const crm = useCrm();
  const toast = useToast();
  const router = useRouter();
  const primary = customer?.contacts.find((c) => c.primary) ?? customer?.contacts[0];
  const sinceIso = customer && !Number.isNaN(Date.parse(customer.since)) ? new Date(customer.since).toISOString() : new Date().toISOString();

  const [v, setV] = useState<CustomerInput>({
    name: customer?.name ?? "",
    industry: customer?.industry ?? "",
    size: customer?.size ?? "51–200",
    website: customer?.website ?? "",
    city: customer?.city ?? "",
    contactName: primary?.name ?? "",
    contactTitle: primary?.title ?? "",
    contactEmail: primary?.email ?? "",
    contactPhone: primary?.phone ?? "",
    owner: customer?.owner ?? user?.short ?? "",
    since: toDateInput(sinceIso),
  });
  const [health, setHealth] = useState<Health>(customer?.health ?? "Healthy");
  const [errors, setErrors] = useState<Errors<Field>>({});
  const set = <K extends keyof CustomerInput>(k: K, value: CustomerInput[K]) => setV((p) => ({ ...p, [k]: value }));

  if (!user || !crm) return null;
  const canPickOwner = can(user, "reassign");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!user || !crm) return;
    const errs: Errors<Field> = {};
    if (!v.name.trim()) errs.name = "Enter the company name.";
    else if (crm.customers.some((c) => c.name.toLowerCase() === v.name.trim().toLowerCase() && c.id !== customer?.id))
      errs.name = "A customer with this name already exists.";
    if (!v.industry) errs.industry = "Choose an industry.";
    if (!v.contactName.trim()) errs.contactName = "Enter the primary contact.";
    if (!v.contactEmail.trim()) errs.contactEmail = "Enter an email address.";
    else if (!isEmail(v.contactEmail)) errs.contactEmail = "Enter a valid email, like name@company.com.";
    if (!isPhone(v.contactPhone)) errs.contactPhone = "Use digits, spaces, + ( ) or -.";
    if (v.website && /\s/.test(v.website.trim())) errs.website = "Website can’t contain spaces.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const clean = { ...v, name: v.name.trim(), contactEmail: v.contactEmail.trim().toLowerCase(), since: fromInputs(v.since, "09:00") };
    if (customer) {
      updateCustomer(
        customer.id,
        {
          name: clean.name,
          industry: clean.industry,
          size: clean.size,
          website: clean.website,
          city: clean.city,
          owner: clean.owner,
          since: clean.since,
          health,
          contacts: customer.contacts.map((c) =>
            c === primary ? { ...c, name: clean.contactName, title: clean.contactTitle, email: clean.contactEmail, phone: clean.contactPhone } : c
          ),
        },
        user
      );
      toast("Customer saved");
      onClose();
    } else {
      const created = createCustomer(clean, user);
      toast(`${created.name} added`, { action: { label: "Open", onClick: () => router.push(`/customers/${created.id}`) } });
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="right"
      title={customer ? "Edit customer" : "New customer"}
      description={customer ? undefined : "Usually created by converting a lead. Use this for customers who came in another way."}
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="customer-form" className={btnPrimary}>
            {customer ? "Save changes" : "Create customer"}
          </button>
        </div>
      }
    >
      <form id="customer-form" onSubmit={submit} noValidate className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-3.5">
          <div className={sectionLabel}>COMPANY</div>
          <TextField label="Company name" required value={v.name} onChange={(e) => set("name", e.target.value)} error={errors.name} placeholder="e.g. Orbit Studios" />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <SelectField
              label="Industry"
              required
              value={v.industry}
              onChange={(e) => set("industry", e.target.value)}
              error={errors.industry}
              options={[{ value: "", label: "Choose…" }, ...INDUSTRIES]}
            />
            <SelectField label="Company size" value={v.size} onChange={(e) => set("size", e.target.value)} options={COMPANY_SIZES} />
            <TextField label="Website" value={v.website} onChange={(e) => set("website", e.target.value)} error={errors.website} placeholder="orbitstudios.com" />
            <TextField label="City" value={v.city} onChange={(e) => set("city", e.target.value)} placeholder="Lahore" />
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className={sectionLabel}>PRIMARY CONTACT</div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextField label="Full name" required value={v.contactName} onChange={(e) => set("contactName", e.target.value)} error={errors.contactName} />
            <TextField label="Job title" value={v.contactTitle} onChange={(e) => set("contactTitle", e.target.value)} />
            <TextField label="Email" required type="email" value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} error={errors.contactEmail} />
            <TextField label="Phone" type="tel" value={v.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} error={errors.contactPhone} />
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className={sectionLabel}>ACCOUNT</div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <SelectField
              label="Account owner"
              value={v.owner}
              onChange={(e) => set("owner", e.target.value)}
              options={canPickOwner ? getUsers().map((u) => u.short) : [v.owner]}
              disabled={!canPickOwner}
            />
            <TextField label="Customer since" type="date" value={v.since} onChange={(e) => set("since", e.target.value)} />
            {customer && (
              <SelectField label="Health" value={health} onChange={(e) => setHealth(e.target.value as Health)} options={["Healthy", "Watch", "At risk"]} />
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
