"use client";

import { useSyncExternalStore } from "react";
import {
  auditMock,
  customersMock,
  leadDetailsMock,
  leadsMock,
  pipelineMock,
  tasksMock,
} from "@/lib/mock-data";
import { initialsForOwner, userByShort, users, type DemoUser } from "@/lib/users";
import { daysFromNow, hoursAgo, initialsOf, uid } from "@/lib/utils";
import type {
  ActivityKind,
  ActivityRecord,
  AuditAction,
  AuditRecord,
  ContactPerson,
  MemberRecord,
  Role,
  CustomerRecord,
  DealRecord,
  DealStage,
  DealTag,
  FollowUp,
  LeadRecord,
  LeadSource,
  LeadStatus,
  ScoreFactor,
  TaskRecord,
} from "@/types";

/**
 * Client-side CRM store.
 *
 * Frontend-first: all records live in the browser (and in localStorage so
 * changes survive a refresh). Every change goes through an action below, so
 * when the API and database are added, each action becomes one request and
 * the screens don't need to change.
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

const STORAGE_KEY = "nexora-crm";
const VERSION = 2;

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
/* Lead scoring: simple, explainable rules.                            */
/* ------------------------------------------------------------------ */

const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|live|icloud)\./i;
const DECISION_MAKER = /(director|head|chief|ceo|cto|coo|cfo|founder|owner|vp|president|partner)/i;

export function scoreLead(
  l: Pick<LeadRecord, "source" | "status" | "title" | "companySize" | "phone" | "email">
): { score: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];
  const sourcePoints: Record<LeadSource, number> = { Referral: 25, Event: 15, LinkedIn: 12, Website: 10, "Cold email": 5 };
  factors.push({ label: `Came from ${l.source.toLowerCase()}`, points: sourcePoints[l.source] });
  if (l.status === "Qualified") factors.push({ label: "Qualified by the sales team", points: 25 });
  if (l.status === "Contacted") factors.push({ label: "Has replied or taken a call", points: 12 });
  if (l.companySize === "200+") factors.push({ label: "Company size: 200 or more employees", points: 20 });
  if (l.companySize === "51–200") factors.push({ label: "Company size: 51 to 200 employees", points: 12 });
  if (l.companySize === "1–50") factors.push({ label: "Company size: up to 50 employees", points: 5 });
  if (DECISION_MAKER.test(l.title)) factors.push({ label: `Decision maker (${l.title})`, points: 15 });
  if (l.phone.trim()) factors.push({ label: "Phone number on file", points: 5 });
  if (l.email && !FREE_MAIL.test(l.email)) factors.push({ label: "Uses a work email", points: 5 });
  const total = factors.reduce((s, f) => s + f.points, 0);
  factors.sort((a, b) => b.points - a.points);
  return { score: Math.min(100, total), factors };
}

/* ------------------------------------------------------------------ */
/* Seed data, built from lib/mock-data.ts with dates relative to now.  */
/* ------------------------------------------------------------------ */

function agoToIso(text: string): string {
  const h = text.match(/(\d+)\s*hours?/);
  if (h) return hoursAgo(Number(h[1]));
  const d = text.match(/(\d+)\s*days?/);
  if (d) return daysFromNow(-Number(d[1]), 11);
  if (/yesterday/i.test(text)) return daysFromNow(-1, 15);
  return daysFromNow(-1, 12);
}

function buildSeed(): CrmState {
  const leads: LeadRecord[] = leadsMock.map((l) => {
    const extra = leadDetailsMock[l.id];
    const base = {
      ...l,
      source: l.source as LeadSource,
      phone: extra?.phone ?? "",
      title: extra?.title ?? "",
      companySize: l.id === "1" ? "200+" : "51–200",
      notes: "",
      createdAt: l.id === "1" ? daysFromNow(-10, 9) : daysFromNow(-12 - Number(l.id), 9),
      lastActivityAt: agoToIso(l.lastActivity),
      stageDates:
        l.id === "1" ? [daysFromNow(-10, 9), daysFromNow(-8, 11), daysFromNow(-2, 14)] : [daysFromNow(-12 - Number(l.id), 9)],
      customerId: null,
    };
    const auto = scoreLead(base);
    return {
      id: base.id,
      initials: base.initials,
      name: base.name,
      email: base.email,
      phone: base.phone,
      title: base.title,
      company: base.company,
      companySize: base.companySize,
      source: base.source,
      status: base.status,
      score: l.score,
      factors: extra?.factors ?? auto.factors,
      autoScore: false,
      owner: l.owner,
      notes: base.notes,
      createdAt: base.createdAt,
      lastActivityAt: base.lastActivityAt,
      stageDates: base.stageDates,
      customerId: null,
    };
  });

  const customers: CustomerRecord[] = customersMock.customers.map((c) => ({
    id: c.id,
    initials: c.initials,
    name: c.name,
    industry: c.industry,
    size: "51–200",
    website: `${c.name.toLowerCase().replace(/[^a-z]/g, "")}.example`,
    city: "Lahore",
    contacts: [
      {
        name: c.contact,
        title: c.id === "1" ? "Founder" : "Primary contact",
        email: `${c.contact.split(" ").slice(-2, -1)[0]?.toLowerCase().replace(/[^a-z]/g, "") || "contact"}@${c.name
          .toLowerCase()
          .replace(/[^a-z]/g, "")}.example`,
        phone: "+92 321 555 0198",
        primary: true,
      },
      ...(c.id === "1"
        ? [{ name: "Rida Farooq", title: "Finance manager", email: "rida@orbitstudios.example", phone: "", primary: false }]
        : []),
    ],
    lifetimeValue: c.lifetimeValue,
    legacyOpenDeals: c.id === "1" ? 0 : c.openDeals,
    health: c.health,
    owner: c.owner,
    since: c.since,
    leadId: null,
  }));

  const closeOffsets: Record<string, number> = { "1": 35, "2": 43, "3": 50, "4": 27, "5": -2, "6": 15, "7": -6, "8": 13, "9": 18 };
  const deals: DealRecord[] = pipelineMock.deals.map((d) => ({
    id: d.id,
    title: d.title,
    company: d.company,
    value: d.value,
    tag: d.tag,
    stage: d.stage,
    probability: STAGE_PROBABILITY[d.stage],
    closeDate: daysFromNow(closeOffsets[d.id] ?? 20, 17),
    owner: ownerFromInitials(d.ownerInitials),
    next: d.next,
    leadId: d.id === "8" ? "1" : null,
    customerId: null,
    lostReason: "",
    closedAt: null,
  }));
  deals.push(
    {
      id: "10", title: "Social media retainer", company: "Orbit Studios", value: 6200, tag: "Warm", stage: "Proposal",
      probability: 65, closeDate: daysFromNow(19, 17), owner: "Sana M.", next: "Send proposal tomorrow",
      leadId: null, customerId: "1", lostReason: "", closedAt: null,
    },
    {
      id: "11", title: "Brand video package", company: "Orbit Studios", value: 15000, tag: "Hot", stage: "Won",
      probability: 100, closeDate: daysFromNow(-2, 12), owner: "Sana M.", next: "Customer created",
      leadId: null, customerId: "1", lostReason: "", closedAt: daysFromNow(-2, 12),
    },
    {
      id: "12", title: "Lab booking system", company: "Aster Pharma", value: 7600, tag: "Warm", stage: "Won",
      probability: 100, closeDate: daysFromNow(-7, 12), owner: "Huma K.", next: "Customer created",
      leadId: null, customerId: "2", lostReason: "", closedAt: daysFromNow(-7, 12),
    },
    {
      id: "13", title: "Ecommerce rebuild", company: "Mint Apparel", value: 4000, tag: "Cold", stage: "Lost",
      probability: 0, closeDate: daysFromNow(-8, 12), owner: "Huma K.", next: "Revisit next quarter",
      leadId: null, customerId: null, lostReason: "Budget", closedAt: daysFromNow(-8, 12),
    }
  );

  const taskDue: Record<string, string> = {
    "1": daysFromNow(0, 17), "2": daysFromNow(0, 15, 30), "3": daysFromNow(0, 19), "4": daysFromNow(0, 18),
    "5": daysFromNow(-3, 10), "6": daysFromNow(3, 11), "7": daysFromNow(-2, 10), "8": daysFromNow(-3, 10),
  };
  const tasks: TaskRecord[] = tasksMock.map((t) => ({
    id: t.id,
    title: t.title,
    type: /call/i.test(t.title) ? "Call" : /email|reply/i.test(t.title) ? "Email" : /demo|kickoff/i.test(t.title) ? "Meeting" : "To-do",
    priority: t.priority,
    dueAt: taskDue[t.id] ?? daysFromNow(1),
    reminder: "1h",
    remindByEmail: true,
    owner: ownerFromInitials(t.ownerInitials),
    leadId: t.leadId ?? null,
    customerId: t.company === "Orbit Studios" ? "1" : null,
    dealId: t.id === "1" ? "8" : null,
    contact: t.contact,
    company: t.company,
    notes: "",
    done: t.done,
    doneAt: t.done ? daysFromNow(-2, 16) : null,
    createdAt: daysFromNow(-4, 9),
    createdBy: "Huma K.",
    followUps:
      t.id === "2"
        ? [
            { id: "f2", at: daysFromNow(-1, 12), by: "Omar T.", outcome: "Email sent", note: "Bilal replied asking to talk today.", rescheduledTo: daysFromNow(0, 15, 30) },
            { id: "f1", at: daysFromNow(-2, 11), by: "Omar T.", outcome: "No answer", note: "Left a voicemail.", rescheduledTo: daysFromNow(-1, 12) },
          ]
        : [],
  }));

  const lead1 = leadDetailsMock["1"];
  const timelineOffsets = [hoursAgo(2), hoursAgo(5), daysFromNow(-1, 16), daysFromNow(-1, 16, 30), daysFromNow(-10, 9)];
  const activities: ActivityRecord[] = [
    ...(lead1?.timeline ?? []).map((e, i) => ({
      id: `a_l1_${i}`,
      kind: e.kind as ActivityKind,
      title: e.title,
      meta: e.meta,
      at: timelineOffsets[i] ?? daysFromNow(-3),
      by: "Huma K.",
      leadId: "1",
    })),
    { id: "a_c1_1", kind: "call", title: "Call with Daniyal Ahmed (12 min)", meta: "Happy with the brand video. Interested in a monthly social retainer.", at: hoursAgo(0.2), by: "Sana M.", customerId: "1" },
    { id: "a_c1_2", kind: "email", title: "Sent: Social media retainer proposal", meta: "Opened 3 times", at: hoursAgo(2), by: "Sana M.", customerId: "1", dealId: "10" },
    { id: "a_c1_3", kind: "note", title: "Rida handles invoices", meta: "Send all billing to rida@orbitstudios.example, not the founder.", at: daysFromNow(-1, 13), by: "Huma K.", customerId: "1" },
    { id: "a_c1_4", kind: "meeting", title: "Kickoff meeting at Orbit office", meta: "Agreed timeline and deliverables for the brand video.", at: daysFromNow(-3, 11), by: "Sana M.", customerId: "1" },
    { id: "a_c1_5", kind: "converted", title: "Became a customer", meta: "Deal “Brand video package” won · $15,000", at: daysFromNow(-2, 12), by: "Sana M.", customerId: "1", dealId: "11" },
    { id: "a_as_1", kind: "assigned", title: "Zainab Hussain assigned to Omar T.", meta: "By Huma K.", at: hoursAgo(3), by: "Huma K.", leadId: "6", assignee: "Omar T." },
  ];

  const auditOffsets = [hoursAgo(0.2), hoursAgo(1), hoursAgo(3), daysFromNow(-1, 16), daysFromNow(-1, 15), daysFromNow(-2, 10), daysFromNow(-10, 9)];
  const audit: AuditRecord[] = auditMock.map((a, i) => ({
    id: `au_${a.id}`,
    at: auditOffsets[i] ?? daysFromNow(-12),
    user: a.user,
    action: a.action,
    record: a.record,
    details: a.details,
  }));

  return { version: VERSION, leads, customers, deals, tasks, activities, audit, members: seedMembers(), readNotices: [] };
}

function seedMembers(): MemberRecord[] {
  const lastActive = [hoursAgo(0), hoursAgo(2), daysFromNow(-1, 17)];
  return [
    ...users.map((u, i) => ({
      id: `m_${u.id}`,
      userId: u.id,
      name: u.name,
      short: u.short,
      initials: u.initials,
      email: u.email,
      role: u.role,
      status: "Active" as const,
      invitedAt: null,
      lastActiveAt: lastActive[i] ?? null,
    })),
    {
      id: "m_kamran",
      userId: null,
      name: "Kamran Shah",
      short: "Kamran S.",
      initials: "KS",
      email: "kamran@nexora.example",
      role: "Sales rep",
      status: "Pending",
      invitedAt: daysFromNow(-1, 11),
      lastActiveAt: null,
    },
  ];
}

function ownerFromInitials(initials: string) {
  return { HK: "Huma K.", OT: "Omar T.", SM: "Sana M." }[initials] ?? "Unassigned";
}

/* ------------------------------------------------------------------ */
/* The store itself.                                                   */
/* ------------------------------------------------------------------ */

let state: CrmState | null = null;
const listeners = new Set<() => void>();

function load(): CrmState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CrmState;
      if (parsed.version === VERSION && Array.isArray(parsed.leads)) return parsed;
      // Older saved data: keep the user's records and add what's new.
      if (parsed.version === 1 && Array.isArray(parsed.leads)) return { ...parsed, version: VERSION, members: seedMembers() };
    }
  } catch {
    // Storage blocked or corrupted: fall back to fresh demo data.
  }
  return buildSeed();
}

function getSnapshot(): CrmState {
  if (!state) state = load();
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    // Keep several open tabs in sync.
    if (e.key === STORAGE_KEY) {
      state = load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function commit(next: CrmState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota or privacy-mode errors; the change still applies in memory.
  }
  listeners.forEach((cb) => cb());
}

function update(fn: (s: CrmState) => CrmState) {
  commit(fn(getSnapshot()));
}

/** All CRM data, or null during server render and hydration (show a skeleton). */
export function useCrm(): CrmState | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/* ------------------------------------------------------------------ */
/* Helpers used inside actions.                                        */
/* ------------------------------------------------------------------ */

function activity(
  actor: DemoUser,
  kind: ActivityKind,
  title: string,
  meta: string,
  refs: Pick<ActivityRecord, "leadId" | "customerId" | "dealId" | "taskId" | "assignee"> = {}
): ActivityRecord {
  return { id: uid("a"), kind, title, meta, at: new Date().toISOString(), by: actor.short, ...refs };
}

function audit(actor: DemoUser, action: AuditAction, record: string, details: string): AuditRecord {
  return { id: uid("au"), at: new Date().toISOString(), user: actor.short, action, record, details };
}

function touchLead(s: CrmState, leadId: string | null | undefined): LeadRecord[] {
  if (!leadId) return s.leads;
  const now = new Date().toISOString();
  return s.leads.map((l) => (l.id === leadId ? { ...l, lastActivityAt: now } : l));
}

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

export type LeadInput = {
  name: string;
  email: string;
  phone: string;
  title: string;
  company: string;
  companySize: string;
  source: LeadSource;
  status: LeadStatus;
  owner: string;
  notes: string;
};

export function createLead(input: LeadInput, actor: DemoUser): LeadRecord {
  const now = new Date().toISOString();
  const { score, factors } = scoreLead(input);
  const lead: LeadRecord = {
    ...input,
    id: uid("lead"),
    initials: initialsOf(input.name),
    score,
    factors,
    autoScore: true,
    createdAt: now,
    lastActivityAt: now,
    stageDates: [now],
    customerId: null,
  };
  update((s) => ({
    ...s,
    leads: [lead, ...s.leads],
    activities: [
      activity(actor, "created", "Lead created", `Source: ${lead.source}${input.notes ? ` · ${input.notes}` : ""}`, { leadId: lead.id }),
      ...(lead.owner !== "Unassigned" && lead.owner !== actor.short
        ? [activity(actor, "assigned", `${lead.name} assigned to ${lead.owner}`, `By ${actor.short}`, { leadId: lead.id, assignee: lead.owner })]
        : []),
      ...s.activities,
    ],
    audit: [audit(actor, "Created", lead.name, `Lead added from ${lead.source.toLowerCase()}`), ...s.audit],
  }));
  return lead;
}

const STATUS_STAGE_INDEX: Partial<Record<LeadStatus, number>> = { New: 0, Contacted: 1, Qualified: 2, Converted: 3 };

export function updateLead(id: string, input: LeadInput, actor: DemoUser) {
  update((s) => {
    const before = s.leads.find((l) => l.id === id);
    if (!before) return s;
    const now = new Date().toISOString();
    const stageDates = [...before.stageDates];
    const idx = STATUS_STAGE_INDEX[input.status];
    if (idx !== undefined && !stageDates[idx]) stageDates[idx] = now;
    const rescored = before.autoScore ? scoreLead(input) : { score: before.score, factors: before.factors };
    const after: LeadRecord = { ...before, ...input, initials: initialsOf(input.name), ...rescored, stageDates, lastActivityAt: now };

    const extra: ActivityRecord[] = [];
    if (before.status !== after.status)
      extra.push(activity(actor, "status", `Status changed from ${before.status} to ${after.status}`, actor.short, { leadId: id }));
    if (before.owner !== after.owner)
      extra.push(activity(actor, "assigned", `${after.name} assigned to ${after.owner}`, `By ${actor.short}`, { leadId: id, assignee: after.owner }));

    return {
      ...s,
      leads: s.leads.map((l) => (l.id === id ? after : l)),
      activities: [...extra, ...s.activities],
      audit: [audit(actor, "Updated", after.name, "Lead details edited"), ...s.audit],
    };
  });
}

export function assignLeads(ids: string[], owner: string, actor: DemoUser) {
  update((s) => {
    const changed = s.leads.filter((l) => ids.includes(l.id) && l.owner !== owner);
    return {
      ...s,
      leads: s.leads.map((l) => (ids.includes(l.id) ? { ...l, owner } : l)),
      activities: [
        ...changed.map((l) =>
          activity(actor, "assigned", `${l.name} assigned to ${owner}`, `By ${actor.short}`, { leadId: l.id, assignee: owner })
        ),
        ...s.activities,
      ],
      audit: [
        ...changed.map((l) => audit(actor, "Reassigned", l.name, `Owner changed from ${l.owner} to ${owner}`)),
        ...s.audit,
      ],
    };
  });
}

export function setLeadsStatus(ids: string[], status: LeadStatus, actor: DemoUser) {
  update((s) => {
    const now = new Date().toISOString();
    const changed = s.leads.filter((l) => ids.includes(l.id) && l.status !== status);
    return {
      ...s,
      leads: s.leads.map((l) => {
        if (!ids.includes(l.id)) return l;
        const stageDates = [...l.stageDates];
        const idx = STATUS_STAGE_INDEX[status];
        if (idx !== undefined && !stageDates[idx]) stageDates[idx] = now;
        const rescored = l.autoScore ? scoreLead({ ...l, status }) : { score: l.score, factors: l.factors };
        return { ...l, status, stageDates, ...rescored, lastActivityAt: now };
      }),
      activities: [
        ...changed.map((l) => activity(actor, "status", `Status changed from ${l.status} to ${status}`, actor.short, { leadId: l.id })),
        ...s.activities,
      ],
      audit: [...changed.map((l) => audit(actor, "Status changed", l.name, `${l.status} to ${status}`)), ...s.audit],
    };
  });
}

export function deleteLeads(ids: string[], actor: DemoUser) {
  update((s) => {
    const gone = s.leads.filter((l) => ids.includes(l.id));
    return {
      ...s,
      leads: s.leads.filter((l) => !ids.includes(l.id)),
      tasks: s.tasks.filter((t) => !(t.leadId && ids.includes(t.leadId) && !t.done)),
      activities: s.activities.filter((a) => !(a.leadId && ids.includes(a.leadId))),
      audit: [...gone.map((l) => audit(actor, "Deleted", l.name, "Lead deleted with its notes and open tasks")), ...s.audit],
    };
  });
}

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

export function logActivity(input: ActivityInput, actor: DemoUser) {
  update((s) => {
    const recordName =
      (input.leadId && s.leads.find((l) => l.id === input.leadId)?.name) ||
      (input.customerId && s.customers.find((c) => c.id === input.customerId)?.name) ||
      "Record";
    const action: AuditAction = input.kind === "note" ? "Note added" : input.kind === "call" ? "Call logged" : "Updated";
    return {
      ...s,
      leads: touchLead(s, input.leadId),
      activities: [
        {
          ...activity(actor, input.kind, input.title, input.meta, { leadId: input.leadId, customerId: input.customerId, dealId: input.dealId }),
          ...(input.at ? { at: input.at } : {}),
        },
        ...s.activities,
      ].sort((a, b) => b.at.localeCompare(a.at)),
      audit: [audit(actor, action, recordName, input.title), ...s.audit],
    };
  });
}

export type ConvertInput = {
  mode: "new" | "existing";
  existingCustomerId: string;
  industry: string;
  owner: string;
  createDeal: boolean;
  deal: { title: string; value: number; stage: DealStage; closeDate: string };
};

/** Turns a lead into a customer (new or existing) and optionally opens a deal. Returns the customer id. */
export function convertLead(leadId: string, input: ConvertInput, actor: DemoUser): string | null {
  const s0 = getSnapshot();
  const lead = s0.leads.find((l) => l.id === leadId);
  if (!lead) return null;
  const now = new Date().toISOString();

  let customerId = input.existingCustomerId;
  let newCustomer: CustomerRecord | null = null;
  const contact: ContactPerson = { name: lead.name, title: lead.title, email: lead.email, phone: lead.phone, primary: true };

  if (input.mode === "new" || !customerId) {
    customerId = uid("cust");
    newCustomer = {
      id: customerId,
      initials: initialsOf(lead.company),
      name: lead.company,
      industry: input.industry,
      size: lead.companySize,
      website: "",
      city: "",
      contacts: [contact],
      lifetimeValue: 0,
      legacyOpenDeals: 0,
      health: "Healthy",
      owner: input.owner,
      since: now,
      leadId: lead.id,
    };
  }

  const existingLeadDeals = s0.deals.filter((d) => d.leadId === leadId);
  const newDeal: DealRecord | null = input.createDeal
    ? {
        id: uid("deal"),
        title: input.deal.title,
        company: lead.company,
        value: input.deal.value,
        tag: lead.score >= 80 ? "Hot" : lead.score >= 50 ? "Warm" : "Cold",
        stage: input.deal.stage,
        probability: STAGE_PROBABILITY[input.deal.stage],
        closeDate: input.deal.closeDate,
        owner: input.owner,
        next: "Kickoff after conversion",
        leadId,
        customerId,
        lostReason: "",
        closedAt: input.deal.stage === "Won" ? now : null,
      }
    : null;

  const wonValue = newDeal?.stage === "Won" ? newDeal.value : 0;
  if (newCustomer) newCustomer.lifetimeValue = wonValue;

  update((s) => ({
    ...s,
    leads: s.leads.map((l) => {
      if (l.id !== leadId) return l;
      const stageDates = [...l.stageDates];
      stageDates[3] = now;
      return { ...l, status: "Converted", customerId, stageDates, lastActivityAt: now };
    }),
    customers: newCustomer
      ? [newCustomer, ...s.customers]
      : s.customers.map((c) =>
          c.id === customerId
            ? {
                ...c,
                lifetimeValue: c.lifetimeValue + wonValue,
                contacts: c.contacts.some((p) => p.email === contact.email) ? c.contacts : [...c.contacts, { ...contact, primary: false }],
              }
            : c
        ),
    // Existing deals of the lead now belong to the customer too.
    deals: [
      ...(newDeal ? [newDeal] : []),
      ...s.deals.map((d) => (existingLeadDeals.some((x) => x.id === d.id) ? { ...d, customerId } : d)),
    ],
    tasks: s.tasks.map((t) => (t.leadId === leadId ? { ...t, customerId } : t)),
    activities: [
      activity(actor, "converted", `Converted to customer: ${lead.company}`, `${lead.name} · by ${actor.short}`, {
        leadId,
        customerId,
        dealId: newDeal?.id,
      }),
      ...s.activities.map((a) => (a.leadId === leadId && !a.customerId ? { ...a, customerId } : a)),
    ],
    audit: [audit(actor, "Converted", lead.company, `${lead.name} became a customer`), ...s.audit],
  }));
  return customerId;
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

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
  owner: string;
  since: string;
};

export function createCustomer(input: CustomerInput, actor: DemoUser): CustomerRecord {
  const customer: CustomerRecord = {
    id: uid("cust"),
    initials: initialsOf(input.name),
    name: input.name,
    industry: input.industry,
    size: input.size,
    website: input.website,
    city: input.city,
    contacts: [{ name: input.contactName, title: input.contactTitle, email: input.contactEmail, phone: input.contactPhone, primary: true }],
    lifetimeValue: 0,
    legacyOpenDeals: 0,
    health: "Healthy",
    owner: input.owner,
    since: input.since,
    leadId: null,
  };
  update((s) => ({
    ...s,
    customers: [customer, ...s.customers],
    activities: [activity(actor, "created", "Customer added", `By ${actor.short}`, { customerId: customer.id }), ...s.activities],
    audit: [audit(actor, "Created", customer.name, "Customer added manually"), ...s.audit],
  }));
  return customer;
}

export function updateCustomer(id: string, patch: Partial<CustomerRecord>, actor: DemoUser) {
  update((s) => {
    const c = s.customers.find((x) => x.id === id);
    if (!c) return s;
    return {
      ...s,
      customers: s.customers.map((x) => (x.id === id ? { ...x, ...patch, initials: initialsOf(patch.name ?? x.name) } : x)),
      audit: [audit(actor, "Updated", patch.name ?? c.name, "Customer details edited"), ...s.audit],
    };
  });
}

export function addContact(customerId: string, contact: ContactPerson, actor: DemoUser) {
  update((s) => ({
    ...s,
    customers: s.customers.map((c) => (c.id === customerId ? { ...c, contacts: [...c.contacts, contact] } : c)),
    audit: [audit(actor, "Updated", s.customers.find((c) => c.id === customerId)?.name ?? "Customer", `Contact ${contact.name} added`), ...s.audit],
  }));
}

/* ------------------------------------------------------------------ */
/* Deals                                                               */
/* ------------------------------------------------------------------ */

export type DealInput = {
  title: string;
  company: string;
  value: number;
  stage: DealStage;
  probability: number;
  closeDate: string;
  owner: string;
  tag: DealTag;
  next: string;
  leadId: string | null;
  customerId: string | null;
};

export function createDeal(input: DealInput, actor: DemoUser): DealRecord {
  const deal: DealRecord = { ...input, id: uid("deal"), lostReason: "", closedAt: null };
  update((s) => ({
    ...s,
    deals: [deal, ...s.deals],
    activities: [
      activity(actor, "deal", `Deal created: ${deal.title}`, `${deal.stage} · $${deal.value.toLocaleString("en-US")}`, {
        dealId: deal.id,
        leadId: deal.leadId ?? undefined,
        customerId: deal.customerId ?? undefined,
      }),
      ...s.activities,
    ],
    audit: [audit(actor, "Created", deal.title, `Deal for ${deal.company}`), ...s.audit],
  }));
  return deal;
}

export function updateDeal(id: string, patch: Partial<DealInput>, actor: DemoUser) {
  update((s) => {
    const before = s.deals.find((d) => d.id === id);
    if (!before) return s;
    const after = { ...before, ...patch };
    const notes: string[] = [];
    if (before.closeDate.slice(0, 10) !== after.closeDate.slice(0, 10)) notes.push("close date changed");
    if (before.value !== after.value) notes.push("value changed");
    if (before.owner !== after.owner) notes.push(`owner changed to ${after.owner}`);
    const moved = before.stage !== after.stage;
    // Save everything except the stage first, so the stage change is recorded from → to.
    const s2 = { ...s, deals: s.deals.map((d) => (d.id === id ? { ...after, stage: before.stage } : d)) };
    const withAudit = {
      ...s2,
      audit: [audit(actor, "Updated", after.title, notes.length ? notes.join(", ") : "Deal details edited"), ...s2.audit],
    };
    return moved ? applyStageChange(withAudit, id, after.stage, actor, after.lostReason) : withAudit;
  });
}

function applyStageChange(s: CrmState, id: string, stage: DealStage, actor: DemoUser, lostReason: string): CrmState {
  const deal = s.deals.find((d) => d.id === id);
  if (!deal) return s;
  const from = deal.stage;
  const closing = stage === "Won" || stage === "Lost";
  const now = new Date().toISOString();
  const nextDeal: DealRecord = {
    ...deal,
    stage,
    probability: STAGE_PROBABILITY[stage],
    closedAt: closing ? now : null,
    lostReason: stage === "Lost" ? lostReason : "",
    next: stage === "Won" ? "Won" : stage === "Lost" ? `Lost · ${lostReason || "No reason"}` : deal.next,
  };
  const customers =
    stage === "Won" && deal.customerId
      ? s.customers.map((c) => (c.id === deal.customerId ? { ...c, lifetimeValue: c.lifetimeValue + deal.value } : c))
      : s.customers;
  return {
    ...s,
    deals: s.deals.map((d) => (d.id === id ? nextDeal : d)),
    customers,
    activities: [
      activity(
        actor,
        "deal",
        stage === "Won" ? `Deal won: ${deal.title}` : stage === "Lost" ? `Deal lost: ${deal.title}` : `${deal.title} moved to ${stage}`,
        stage === "Lost" ? `Reason: ${lostReason || "Not given"}` : `From ${from} · by ${actor.short}`,
        { dealId: id, leadId: deal.leadId ?? undefined, customerId: deal.customerId ?? undefined }
      ),
      ...s.activities,
    ],
    audit: [audit(actor, "Deal moved", deal.title, `${deal.stage} to ${stage}${stage === "Lost" && lostReason ? ` (${lostReason})` : ""}`), ...s.audit],
  };
}

export function moveDeal(id: string, stage: DealStage, actor: DemoUser, lostReason = "") {
  update((s) => {
    const deal = s.deals.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return s;
    return applyStageChange(s, id, stage, actor, lostReason);
  });
}

export function deleteDeal(id: string, actor: DemoUser) {
  update((s) => {
    const deal = s.deals.find((d) => d.id === id);
    return {
      ...s,
      deals: s.deals.filter((d) => d.id !== id),
      tasks: s.tasks.map((t) => (t.dealId === id ? { ...t, dealId: null } : t)),
      audit: deal ? [audit(actor, "Deleted", deal.title, "Deal deleted"), ...s.audit] : s.audit,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export type TaskInput = Pick<
  TaskRecord,
  "title" | "type" | "priority" | "dueAt" | "reminder" | "remindByEmail" | "owner" | "leadId" | "customerId" | "dealId" | "contact" | "company" | "notes"
>;

export function createTask(input: TaskInput, actor: DemoUser): TaskRecord {
  const task: TaskRecord = {
    ...input,
    id: uid("task"),
    done: false,
    doneAt: null,
    createdAt: new Date().toISOString(),
    createdBy: actor.short,
    followUps: [],
  };
  update((s) => ({
    ...s,
    tasks: [task, ...s.tasks],
    activities: [
      ...(task.owner !== actor.short
        ? [activity(actor, "assigned", `Task assigned to ${task.owner}: ${task.title}`, `By ${actor.short}`, { taskId: task.id, leadId: task.leadId ?? undefined, assignee: task.owner })]
        : []),
      ...s.activities,
    ],
    audit: [audit(actor, "Task created", task.title, `Assigned to ${task.owner}`), ...s.audit],
  }));
  return task;
}

export function updateTask(id: string, patch: Partial<TaskInput>, actor: DemoUser) {
  update((s) => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    audit: [audit(actor, "Updated", s.tasks.find((t) => t.id === id)?.title ?? "Task", "Task edited"), ...s.audit],
  }));
}

export function toggleTask(id: string, actor: DemoUser) {
  update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (!t) return s;
    const done = !t.done;
    return {
      ...s,
      tasks: s.tasks.map((x) => (x.id === id ? { ...x, done, doneAt: done ? new Date().toISOString() : null } : x)),
      leads: touchLead(s, t.leadId),
      audit: done ? [audit(actor, "Task completed", t.title, `Completed by ${actor.short}`), ...s.audit] : s.audit,
    };
  });
}

export function snoozeTask(id: string, newDueAt: string, actor: DemoUser) {
  addFollowUp(id, { outcome: "Snoozed", note: "", rescheduledTo: newDueAt }, actor);
}

export function addFollowUp(
  taskId: string,
  input: { outcome: string; note: string; rescheduledTo: string | null; closeTask?: boolean },
  actor: DemoUser
) {
  update((s) => {
    const t = s.tasks.find((x) => x.id === taskId);
    if (!t) return s;
    const fu: FollowUp = {
      id: uid("fu"),
      at: new Date().toISOString(),
      by: actor.short,
      outcome: input.outcome,
      note: input.note,
      rescheduledTo: input.rescheduledTo,
    };
    const now = new Date().toISOString();
    return {
      ...s,
      tasks: s.tasks.map((x) =>
        x.id === taskId
          ? {
              ...x,
              followUps: [fu, ...x.followUps],
              dueAt: input.rescheduledTo ?? x.dueAt,
              done: input.closeTask ? true : x.done,
              doneAt: input.closeTask ? now : x.doneAt,
            }
          : x
      ),
      leads: touchLead(s, t.leadId),
      activities: t.leadId || t.customerId
        ? [
            activity(actor, t.type === "Email" ? "email" : t.type === "Meeting" ? "meeting" : "call", `${t.title}: ${input.outcome}`, input.note || `Follow-up by ${actor.short}`, {
              leadId: t.leadId ?? undefined,
              customerId: t.customerId ?? undefined,
              taskId,
            }),
            ...s.activities,
          ]
        : s.activities,
    };
  });
}

export function deleteTask(id: string, actor: DemoUser) {
  update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    return {
      ...s,
      tasks: s.tasks.filter((x) => x.id !== id),
      audit: t ? [audit(actor, "Deleted", t.title, "Task deleted"), ...s.audit] : s.audit,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

export function inviteMember(input: { name: string; email: string; role: Role }, actor: DemoUser): MemberRecord {
  const parts = input.name.trim().split(/\s+/);
  const member: MemberRecord = {
    id: uid("m"),
    userId: null,
    name: input.name.trim(),
    short: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0],
    initials: initialsOf(input.name),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: "Pending",
    invitedAt: new Date().toISOString(),
    lastActiveAt: null,
  };
  update((s) => ({
    ...s,
    members: [...s.members, member],
    audit: [audit(actor, "Created", member.email, `Invited as ${member.role}`), ...s.audit],
  }));
  return member;
}

export function changeMemberRole(id: string, role: Role, actor: DemoUser) {
  update((s) => {
    const m = s.members.find((x) => x.id === id);
    if (!m || m.role === role) return s;
    return {
      ...s,
      members: s.members.map((x) => (x.id === id ? { ...x, role } : x)),
      audit: [audit(actor, "Role changed", m.name, `${m.role} to ${role}`), ...s.audit],
    };
  });
}

export function resendInvite(id: string, actor: DemoUser) {
  update((s) => {
    const m = s.members.find((x) => x.id === id);
    if (!m) return s;
    return {
      ...s,
      members: s.members.map((x) => (x.id === id ? { ...x, invitedAt: new Date().toISOString() } : x)),
      audit: [audit(actor, "Updated", m.email, "Invite sent again"), ...s.audit],
    };
  });
}

export function revokeInvite(id: string, actor: DemoUser) {
  update((s) => {
    const m = s.members.find((x) => x.id === id);
    if (!m || m.status !== "Pending") return s;
    return {
      ...s,
      members: s.members.filter((x) => x.id !== id),
      audit: [audit(actor, "Deleted", m.email, "Invite cancelled"), ...s.audit],
    };
  });
}

/* ------------------------------------------------------------------ */
/* Notifications and misc                                              */
/* ------------------------------------------------------------------ */

export function markNoticesRead(ids: string[]) {
  update((s) => ({ ...s, readNotices: Array.from(new Set([...s.readNotices, ...ids])) }));
}

export function recordSignIn(actor: DemoUser) {
  update((s) => ({ ...s, audit: [audit(actor, "Signed in", actor.name, `Signed in as ${actor.role}`), ...s.audit] }));
}

/** Puts the demo data back. Handy before a demo or review. */
export function resetDemoData() {
  commit(buildSeed());
}

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export function ownerInitials(short: string) {
  return initialsForOwner(short);
}

export function ownerName(short: string) {
  return userByShort(short)?.name ?? short;
}

export function openDealsFor(s: CrmState, customer: CustomerRecord) {
  return s.deals.filter((d) => d.customerId === customer.id && OPEN_STAGES.includes(d.stage)).length + customer.legacyOpenDeals;
}
