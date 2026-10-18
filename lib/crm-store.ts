"use client";

import { useSyncExternalStore } from "react";
import { api, ApiError, errorMessage } from "@/lib/api";
import {
  CODES,
  mapActivity,
  mapAudit,
  mapCustomer,
  mapDeal,
  mapLead,
  mapMember,
  mapTask,
  mapUser,
  type ApiBootstrap,
  type ApiCustomer,
  type ApiDeal,
  type ApiLead,
  type ApiTask,
  type ApiUser,
} from "@/lib/api-mappers";
import { onSignedOut, setSessionUser } from "@/lib/session";
import { setDirectory } from "@/lib/users";
import type {
  ActivityRecord,
  AuditRecord,
  ContactPerson,
  CustomerRecord,
  DealRecord,
  DealStage,
  DealTag,
  LeadRecord,
  LeadSource,
  LeadStatus,
  MemberRecord,
  MonthRevenue,
  Role,
  TaskRecord,
} from "@/types";

/**
 * Client-side CRM store.
 *
 * Holds everything the signed-in user may see, loaded from the Laravel API
 * (GET /api/crm, see loadCrm below). Screens read it with useCrm().
 *
 * Every change goes through an action below. Each action is one API request; the
 * server checks permissions, saves to MySQL and records history and the audit log,
 * then the store reloads so the screens show exactly what was saved.
 */

export type CrmState = {
  version: number;
  leads: LeadRecord[];
  customers: CustomerRecord[];
  deals: DealRecord[];
  tasks: TaskRecord[];
  activities: ActivityRecord[];
  audit: AuditRecord[];
  members: MemberRecord[];
  readNotices: string[];
};

const VERSION = 3;

export const DEAL_STAGES: DealStage[] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];
export const OPEN_STAGES: DealStage[] = ["New", "Contacted", "Qualified", "Proposal"];
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  New: 10,
  Contacted: 25,
  Qualified: 50,
  Proposal: 65,
  Won: 100,
  Lost: 0,
};
export const LEAD_SOURCES: LeadSource[] = ["Referral", "Website", "LinkedIn", "Event", "Cold email"];
export const LEAD_STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Unqualified"];
export const COMPANY_SIZES = ["1–50", "51–200", "200+"];
export const INDUSTRIES = [
  "Design agency",
  "Food and beverage",
  "Healthcare",
  "Logistics",
  "Manufacturing",
  "Retail",
  "Software",
  "Travel",
  "Other",
];
export const LOST_REASONS = ["Budget", "Chose a competitor", "No response", "Timing", "Other"];

/* ------------------------------------------------------------------ */
/* The store itself.                                                   */
/* ------------------------------------------------------------------ */

let state: CrmState | null = null;
const listeners = new Set<() => void>();

export type CrmStatus = { status: "idle" | "loading" | "ready" | "error"; error: string | null };
let status: CrmStatus = { status: "idle", error: null };

function emit() {
  listeners.forEach((cb) => cb());
}

function setStatus(next: CrmStatus) {
  status = next;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function commit(next: CrmState) {
  state = next;
  emit();
}

function update(fn: (s: CrmState) => CrmState) {
  // Nothing to change before the data has loaded (screens show a skeleton until then).
  if (state) commit(fn(state));
}

let inflight: Promise<void> | null = null;

/**
 * Loads everything the signed-in user may see (GET /api/crm) into the store.
 * Called by the app shell on start-up; call it again to refresh after changes.
 * A 401 (signed out) is handled by the app shell, which sends the user to /login.
 */
export function loadCrm(): Promise<void> {
  if (inflight) return inflight;
  if (!state) setStatus({ status: "loading", error: null });
  inflight = api
    .get<ApiBootstrap>("/crm")
    .then((data) => {
      setDirectory(data.members.filter((m) => m.status === "active").map(mapUser));
      setSessionUser(mapUser(data.user));
      state = {
        version: VERSION,
        leads: data.leads.map(mapLead),
        customers: data.customers.map(mapCustomer),
        deals: data.deals.map(mapDeal),
        tasks: data.tasks.map(mapTask),
        activities: data.activities.map(mapActivity),
        audit: data.audit.map(mapAudit),
        members: data.members.map(mapMember),
        readNotices: data.readNotices ?? [],
      };
      setStatus({ status: "ready", error: null });
    })
    .catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        setStatus({ status: "idle", error: null });
        return;
      }
      // A refresh that fails (e.g. after a change, with the server down) keeps the data
      // on screen; the action that triggered it shows its own error. The full-page
      // "Couldn't load your data" screen is only for when there is nothing to show.
      if (state) return;
      setStatus({ status: "error", error: errorMessage(err) });
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

let queued: Promise<void> | null = null;

/**
 * Reloads the data after a change. If a load is already running (it may have started
 * before the change was saved), waits for it and loads once more, so the result is fresh.
 */
export function refreshCrm(): Promise<void> {
  if (!inflight) return loadCrm();
  if (!queued) {
    queued = inflight.then(() => {
      queued = null;
      return loadCrm();
    });
  }
  return queued;
}

// Signing out (or the session ending) drops everything that belonged to that user.
onSignedOut(() => {
  state = null;
  setDirectory([]);
  setStatus({ status: "idle", error: null });
});

/** All CRM data, or null while it loads (show a skeleton). */
export function useCrm(): CrmState | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => null
  );
}

/** Whether the data is loading, ready, or failed to load (with a message). */
export function useCrmStatus(): CrmStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => status
  );
}

/* ------------------------------------------------------------------ */
/* Actions. Each one is an API request; afterwards the store reloads   */
/* from the server, so history, audit log, scores and lifetime values  */
/* are exactly what the database worked out. They throw ApiError on    */
/* failure (validation errors are on err.errors, keyed by API field).  */
/* ------------------------------------------------------------------ */

const num = (id: string | null | undefined): number | null => (id ? Number(id) : null);
const day = (iso: string) => iso.slice(0, 10);

/** Runs a change, then reloads everything from the server. */
async function mutate<T>(request: () => Promise<T>): Promise<T> {
  const result = await request();
  await refreshCrm();
  return result;
}

/**
 * For changes that should feel instant (ticking off a task, dragging a deal, reading
 * notices): update the screen first, then save. If saving fails, put the screen back as
 * it was (this works offline too), reload to pick up anything else that changed, and
 * pass the error on.
 */
async function optimistic(apply: (s: CrmState) => CrmState, request: () => Promise<unknown>, refresh = true): Promise<void> {
  const before = state;
  update(apply);
  try {
    await request();
  } catch (err) {
    if (before) commit(before);
    await refreshCrm();
    throw err;
  }
  if (refresh) await refreshCrm();
}

/* ------------------------------- Leads ------------------------------- */

export type LeadInput = {
  name: string;
  email: string;
  phone: string;
  title: string;
  company: string;
  companySize: string;
  source: LeadSource;
  status: LeadStatus;
  /** User id of the owner, or "" for nobody. */
  ownerId: string;
  notes: string;
};

/** API field → LeadInput field, for showing server validation errors next to the right input. */
export const LEAD_FIELDS = {
  name: "name",
  email: "email",
  phone: "phone",
  job_title: "title",
  company: "company",
  company_size: "companySize",
  source: "source",
  status: "status",
  owner_id: "ownerId",
  notes: "notes",
} as const;

function leadPayload(input: LeadInput) {
  return {
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    job_title: input.title || null,
    company: input.company,
    company_size: input.companySize || null,
    source: CODES.leadSource[input.source],
    status: CODES.leadStatus[input.status],
    owner_id: num(input.ownerId),
    notes: input.notes || null,
  };
}

export async function createLead(input: LeadInput): Promise<LeadRecord> {
  const res = await mutate(() => api.post<{ data: ApiLead }>("/leads", leadPayload(input)));
  return mapLead(res.data);
}

export async function updateLead(id: string, input: LeadInput): Promise<void> {
  const before = state?.leads.find((l) => l.id === id);
  const payload: Partial<ReturnType<typeof leadPayload>> = leadPayload(input);
  // Converted leads keep their status (the form can't set "Converted").
  if (before?.status === "Converted") delete payload.status;
  await mutate(() => api.put(`/leads/${id}`, payload));
}

/** Gives leads to the user with this id ("" leaves them unassigned). */
export async function assignLeads(ids: string[], ownerId: string): Promise<void> {
  await mutate(() => api.post("/leads/bulk", { action: "assign", ids: ids.map(Number), owner_id: num(ownerId) }));
}

export async function setLeadsStatus(ids: string[], status: LeadStatus): Promise<void> {
  await mutate(() => api.post("/leads/bulk", { action: "status", ids: ids.map(Number), status: CODES.leadStatus[status] }));
}

export async function deleteLeads(ids: string[]): Promise<void> {
  await mutate(() => api.post("/leads/bulk", { action: "delete", ids: ids.map(Number) }));
}

/** Uploads a CSV (columns: Name, Email, Company, Phone, Job title, Source). The server skips duplicates. */
export async function importLeads(file: File): Promise<{ added: number; skipped: number }> {
  const form = new FormData();
  form.append("file", file);
  return mutate(() => api.post<{ added: number; skipped: number }>("/leads/import", form));
}

/* ------------------------------ History ------------------------------ */

export type ActivityInput = {
  kind: "call" | "email" | "meeting" | "note";
  title: string;
  meta: string;
  leadId?: string;
  customerId?: string;
  dealId?: string;
  /** When it happened, if not now (e.g. a call made earlier today). */
  at?: string;
};

export async function logActivity(input: ActivityInput): Promise<void> {
  await mutate(() =>
    api.post("/activities", {
      type: input.kind,
      title: input.title,
      body: input.meta || null,
      occurred_at: input.at ? new Date(input.at).toISOString() : null,
      lead_id: num(input.leadId),
      customer_id: num(input.customerId),
      deal_id: num(input.dealId),
    })
  );
}

/* ----------------------------- Converting ----------------------------- */

export type ConvertInput = {
  mode: "new" | "existing";
  existingCustomerId: string;
  industry: string;
  ownerId: string;
  createDeal: boolean;
  deal: { title: string; value: number; stage: DealStage; closeDate: string };
};

/** Turns a lead into a customer (new or existing) and optionally opens a deal. Returns the customer id. */
export async function convertLead(leadId: string, input: ConvertInput): Promise<string> {
  const res = await mutate(() =>
    api.post<{ data: ApiCustomer }>(`/leads/${leadId}/convert`, {
      mode: input.mode,
      customer_id: input.mode === "existing" ? num(input.existingCustomerId) : null,
      industry: input.mode === "new" ? input.industry : null,
      owner_id: num(input.ownerId),
      create_deal: input.createDeal,
      deal: input.createDeal
        ? {
            title: input.deal.title,
            value: input.deal.value,
            stage: CODES.dealStage[input.deal.stage],
            close_date: day(input.deal.closeDate),
          }
        : null,
    })
  );
  return String(res.data.id);
}

/* ------------------------------ Customers ------------------------------ */

export type CustomerInput = {
  name: string;
  industry: string;
  size: string;
  website: string;
  city: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  ownerId: string;
  since: string;
  /** Only used when editing. */
  health?: CustomerRecord["health"];
};

export const CUSTOMER_FIELDS = {
  name: "name",
  industry: "industry",
  size: "size",
  website: "website",
  city: "city",
  owner_id: "ownerId",
  customer_since: "since",
  "contact.name": "contactName",
  "contact.job_title": "contactTitle",
  "contact.email": "contactEmail",
  "contact.phone": "contactPhone",
} as const;

function customerPayload(input: CustomerInput) {
  return {
    name: input.name,
    industry: input.industry,
    size: input.size || null,
    website: input.website || null,
    city: input.city || null,
    owner_id: num(input.ownerId),
    customer_since: input.since ? day(input.since) : null,
    ...(input.health ? { health: CODES.health[input.health] } : {}),
    contact: {
      name: input.contactName,
      job_title: input.contactTitle || null,
      email: input.contactEmail,
      phone: input.contactPhone || null,
    },
  };
}

export async function createCustomer(input: CustomerInput): Promise<CustomerRecord> {
  const res = await mutate(() => api.post<{ data: ApiCustomer }>("/customers", customerPayload(input)));
  return mapCustomer(res.data);
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  await mutate(() => api.put(`/customers/${id}`, customerPayload(input)));
}

/** Admins only. Open tasks go; deals stay in the pipeline and reports, no longer linked to a customer. */
export async function deleteCustomer(id: string): Promise<void> {
  await mutate(() => api.delete(`/customers/${id}`));
}

export async function addContact(customerId: string, contact: ContactPerson): Promise<void> {
  await mutate(() =>
    api.post(`/customers/${customerId}/contacts`, {
      name: contact.name,
      job_title: contact.title || null,
      email: contact.email || null,
      phone: contact.phone || null,
    })
  );
}

/* -------------------------------- Deals -------------------------------- */

export type DealInput = {
  title: string;
  company: string;
  value: number;
  stage: DealStage;
  probability: number;
  closeDate: string;
  ownerId: string;
  tag: DealTag;
  next: string;
  leadId: string | null;
  customerId: string | null;
};

function dealPayload(input: DealInput, lostReason = "") {
  return {
    title: input.title,
    company: input.company,
    value: input.value,
    stage: CODES.dealStage[input.stage],
    probability: input.probability,
    temperature: CODES.dealTag[input.tag],
    expected_close_date: day(input.closeDate),
    next_step: input.next || null,
    owner_id: num(input.ownerId),
    lead_id: num(input.leadId),
    customer_id: num(input.customerId),
    lost_reason: lostReason || null,
  };
}

export async function createDeal(input: DealInput): Promise<DealRecord> {
  const res = await mutate(() => api.post<{ data: ApiDeal }>("/deals", dealPayload(input)));
  return mapDeal(res.data);
}

/** Saves changes to a deal. A stage change is recorded as a move (Lost needs `lostReason`). */
export async function updateDeal(id: string, patch: Partial<DealInput>, lostReason = ""): Promise<void> {
  const before = state?.deals.find((d) => d.id === id);
  if (!before) throw new ApiError(404, "That deal no longer exists.");
  const input: DealInput = {
    title: before.title,
    company: before.company,
    value: before.value,
    stage: before.stage,
    probability: before.probability,
    closeDate: before.closeDate,
    ownerId: before.ownerId,
    tag: before.tag,
    next: before.next,
    leadId: before.leadId,
    customerId: before.customerId,
    ...patch,
  };
  await mutate(() => api.put(`/deals/${id}`, dealPayload(input, lostReason || before.lostReason)));
}

/** Moves a deal to another stage (drag and drop, card menu, Won/Lost buttons). Updates the board at once. */
export async function moveDeal(id: string, stage: DealStage, lostReason = ""): Promise<void> {
  const deal = state?.deals.find((d) => d.id === id);
  if (!deal || deal.stage === stage) return;
  const closing = stage === "Won" || stage === "Lost";
  await optimistic(
    (s) => ({
      ...s,
      deals: s.deals.map((d) =>
        d.id === id
          ? { ...d, stage, probability: STAGE_PROBABILITY[stage], closedAt: closing ? new Date().toISOString() : null, lostReason: stage === "Lost" ? lostReason : "" }
          : d
      ),
    }),
    () => api.post(`/deals/${id}/move`, { stage: CODES.dealStage[stage], lost_reason: lostReason || null })
  );
}

export async function deleteDeal(id: string): Promise<void> {
  await mutate(() => api.delete(`/deals/${id}`));
}

/* -------------------------------- Tasks -------------------------------- */

export type TaskInput = Pick<
  TaskRecord,
  "title" | "type" | "priority" | "dueAt" | "reminder" | "remindByEmail" | "ownerId" | "leadId" | "customerId" | "dealId" | "contact" | "company" | "notes"
>;

export const TASK_FIELDS = {
  title: "title",
  type: "type",
  priority: "priority",
  due_at: "dueAt",
  reminder: "reminder",
  assigned_to: "ownerId",
  lead_id: "leadId",
  customer_id: "customerId",
  deal_id: "dealId",
  notes: "notes",
} as const;

function taskPayload(input: TaskInput) {
  return {
    title: input.title,
    type: CODES.taskType[input.type],
    priority: CODES.taskPriority[input.priority],
    due_at: new Date(input.dueAt).toISOString(),
    reminder: input.reminder,
    remind_by_email: input.remindByEmail,
    assigned_to: num(input.ownerId),
    lead_id: num(input.leadId),
    customer_id: num(input.customerId),
    deal_id: num(input.dealId),
    notes: input.notes || null,
  };
}

export async function createTask(input: TaskInput): Promise<TaskRecord> {
  const res = await mutate(() => api.post<{ data: ApiTask }>("/tasks", taskPayload(input)));
  return mapTask(res.data);
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  const before = state?.tasks.find((t) => t.id === id);
  if (!before) throw new ApiError(404, "That task no longer exists.");
  await mutate(() => api.put(`/tasks/${id}`, taskPayload({ ...before, ...patch })));
}

/** Marks a task done, or reopens it. Ticks the box at once. */
export async function toggleTask(id: string): Promise<void> {
  await optimistic(
    (s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : new Date().toISOString() } : t)),
    }),
    () => api.post(`/tasks/${id}/toggle`)
  );
}

export async function addFollowUp(taskId: string, input: { outcome: string; note: string; rescheduledTo: string | null; closeTask?: boolean }): Promise<void> {
  await mutate(() =>
    api.post(`/tasks/${taskId}/follow-ups`, {
      outcome: input.outcome,
      note: input.note || null,
      reschedule_to: input.rescheduledTo ? new Date(input.rescheduledTo).toISOString() : null,
      close: Boolean(input.closeTask),
    })
  );
}

export async function snoozeTask(id: string, newDueAt: string): Promise<void> {
  await addFollowUp(id, { outcome: "Snoozed", note: "", rescheduledTo: newDueAt });
}

export async function deleteTask(id: string): Promise<void> {
  await mutate(() => api.delete(`/tasks/${id}`));
}

/* -------------------------------- Team -------------------------------- */

export async function inviteMember(input: { name: string; email: string; role: Role }): Promise<MemberRecord> {
  const res = await mutate(() =>
    api.post<{ data: ApiUser }>("/team/invite", { name: input.name.trim(), email: input.email.trim().toLowerCase(), role: CODES.role[input.role] })
  );
  return mapMember(res.data);
}

export async function changeMemberRole(id: string, role: Role): Promise<void> {
  await mutate(() => api.patch(`/team/${id}/role`, { role: CODES.role[role] }));
}

export async function resendInvite(id: string): Promise<void> {
  await mutate(() => api.post(`/team/${id}/resend`));
}

export async function revokeInvite(id: string): Promise<void> {
  await mutate(() => api.delete(`/team/${id}`));
}

/* ---------------------------- Notifications ---------------------------- */

export async function markNoticesRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await optimistic(
    (s) => ({ ...s, readNotices: Array.from(new Set([...s.readNotices, ...ids])) }),
    () => api.post("/notifications/read", { keys: ids }),
    false
  );
}

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export function openDealsFor(s: CrmState, customer: CustomerRecord) {
  return s.deals.filter((d) => d.customerId === customer.id && OPEN_STAGES.includes(d.stage)).length + customer.legacyOpenDeals;
}

/** Revenue won per calendar month for the last `count` months, oldest first (from won deals' close dates). */
export function monthlyRevenue(deals: DealRecord[], count = 12): MonthRevenue[] {
  const now = new Date();
  const months: MonthRevenue[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const amount = deals
      .filter((d) => d.stage === "Won" && d.closedAt && new Date(d.closedAt) >= start && new Date(d.closedAt) < end)
      .reduce((sum, d) => sum + d.value, 0);
    months.push({ month: start.toLocaleDateString("en-US", { month: "short" }), amount });
  }
  return months;
}
