import type {
  ActivityKind,
  ActivityRecord,
  AuditAction,
  AuditRecord,
  CustomerRecord,
  DealRecord,
  DealStage,
  DealTag,
  Health,
  LeadRecord,
  LeadSource,
  LeadStatus,
  MemberRecord,
  ReminderOption,
  Role,
  ScoreFactor,
  TaskPriority,
  TaskRecord,
  TaskType,
} from "@/types";
import type { DemoUser } from "@/lib/users";

/**
 * Converts the API's JSON (see backend/app/Http/Resources) into the records the
 * screens use. The API sends numeric ids and lowercase codes ("sales_rep", "cold_email");
 * the screens use string ids and labels ("Sales rep", "Cold email").
 */

/* ----------------------------- API shapes ----------------------------- */

export type ApiUser = {
  id: number;
  name: string;
  short: string;
  initials: string;
  email: string;
  role: string;
  roleLabel: string;
  status: "active" | "pending";
  jobTitle: string | null;
  invitedAt: string | null;
  lastActiveAt: string | null;
};

export type ApiLead = {
  id: number;
  initials: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  company: string;
  companySize: string;
  source: string;
  status: string;
  score: number;
  factors: ScoreFactor[];
  autoScore: boolean;
  ownerId: number | null;
  ownerName: string | null;
  customerId: number | null;
  notes: string;
  createdAt: string | null;
  lastActivityAt: string | null;
  stageDates: (string | null)[];
};

export type ApiContact = { id: number; name: string; jobTitle: string; email: string; phone: string; primary: boolean };

export type ApiCustomer = {
  id: number;
  initials: string;
  name: string;
  industry: string;
  size: string;
  website: string;
  city: string;
  health: string;
  lifetimeValue: number;
  legacyOpenDeals: number;
  ownerId: number | null;
  ownerName: string | null;
  leadId: number | null;
  since: string | null;
  contacts?: ApiContact[];
};

export type ApiDeal = {
  id: number;
  title: string;
  company: string;
  value: number;
  stage: string;
  probability: number;
  temperature: string;
  closeDate: string | null;
  nextStep: string;
  ownerId: number | null;
  ownerName: string | null;
  leadId: number | null;
  customerId: number | null;
  lostReason: string;
  closedAt: string | null;
  createdAt: string | null;
};

export type ApiFollowUp = { id: number; at: string | null; by: string | null; outcome: string; note: string; rescheduledTo: string | null };

export type ApiTask = {
  id: number;
  title: string;
  type: string;
  priority: string;
  dueAt: string | null;
  reminder: string;
  remindByEmail: boolean;
  assignedTo: number | null;
  ownerName: string | null;
  createdBy: string | null;
  leadId: number | null;
  customerId: number | null;
  dealId: number | null;
  contact: string;
  company: string;
  notes: string;
  done: boolean;
  doneAt: string | null;
  createdAt: string | null;
  followUps?: ApiFollowUp[];
};

export type ApiActivity = {
  id: number;
  type: string;
  title: string;
  body: string;
  by: string;
  leadId: number | null;
  customerId: number | null;
  dealId: number | null;
  taskId: number | null;
  assigneeId: number | null;
  assigneeName: string | null;
  at: string | null;
};

export type ApiAudit = { id: number; at: string | null; user: string; action: string; record: string; details: string };

/** GET /api/crm */
export type ApiBootstrap = {
  user: ApiUser;
  leads: ApiLead[];
  customers: ApiCustomer[];
  deals: ApiDeal[];
  tasks: ApiTask[];
  activities: ApiActivity[];
  audit: ApiAudit[];
  members: ApiUser[];
  readNotices: string[];
};

/* ------------------------------ Code ↔ label ------------------------------ */

const LEAD_SOURCE: Record<string, LeadSource> = {
  referral: "Referral",
  website: "Website",
  linkedin: "LinkedIn",
  event: "Event",
  cold_email: "Cold email",
};
const LEAD_STATUS: Record<string, LeadStatus> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
};
const DEAL_STAGE: Record<string, DealStage> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
const DEAL_TAG: Record<string, DealTag> = { hot: "Hot", warm: "Warm", new: "New", cold: "Cold" };
const HEALTH: Record<string, Health> = { healthy: "Healthy", watch: "Watch", at_risk: "At risk" };
const TASK_TYPE: Record<string, TaskType> = { call: "Call", email: "Email", meeting: "Meeting", todo: "To-do" };
const TASK_PRIORITY: Record<string, TaskPriority> = { urgent: "Urgent", high: "High", medium: "Medium", low: "Low" };
const REMINDERS: ReminderOption[] = ["none", "15m", "1h", "1d"];
const ROLE: Record<string, Role> = { admin: "Admin", manager: "Manager", sales_rep: "Sales rep" };

/** Reverse lookup, for sending labels back to the API: toCode(LEAD_SOURCE_CODES, "Cold email") → "cold_email". */
function invert<T extends string>(map: Record<string, T>): Record<T, string> {
  return Object.fromEntries(Object.entries(map).map(([code, label]) => [label, code])) as Record<T, string>;
}
export const CODES = {
  leadSource: invert(LEAD_SOURCE),
  leadStatus: invert(LEAD_STATUS),
  dealStage: invert(DEAL_STAGE),
  dealTag: invert(DEAL_TAG),
  health: invert(HEALTH),
  taskType: invert(TASK_TYPE),
  taskPriority: invert(TASK_PRIORITY),
  role: invert(ROLE),
};

/* -------------------------------- Helpers -------------------------------- */

const str = (id: number | null | undefined): string | null => (id === null || id === undefined ? null : String(id));
const opt = (id: number | null | undefined): string | undefined => (id === null || id === undefined ? undefined : String(id));
const OWNERLESS = "Unassigned";
/** A date-only value ("2026-10-28") as a local date-time, so it never shifts a day across time zones. */
const localDate = (date: string | null, time: string) => (date ? `${date}T${time}` : "");

/* -------------------------------- Mappers -------------------------------- */

export function mapUser(u: ApiUser): DemoUser {
  return { id: String(u.id), name: u.name, short: u.short, initials: u.initials, email: u.email, role: ROLE[u.role] ?? "Sales rep" };
}

export function mapMember(u: ApiUser): MemberRecord {
  const active = u.status === "active";
  return {
    id: String(u.id),
    userId: active ? String(u.id) : null,
    name: u.name,
    short: u.short,
    initials: u.initials,
    email: u.email,
    role: ROLE[u.role] ?? "Sales rep",
    status: active ? "Active" : "Pending",
    invitedAt: u.invitedAt,
    lastActiveAt: u.lastActiveAt,
  };
}

export function mapLead(l: ApiLead): LeadRecord {
  const createdAt = l.createdAt ?? new Date().toISOString();
  return {
    id: String(l.id),
    initials: l.initials,
    name: l.name,
    email: l.email,
    phone: l.phone ?? "",
    title: l.jobTitle ?? "",
    company: l.company,
    companySize: l.companySize ?? "",
    source: LEAD_SOURCE[l.source] ?? "Website",
    status: LEAD_STATUS[l.status] ?? "New",
    score: l.score,
    factors: l.factors ?? [],
    autoScore: l.autoScore,
    owner: l.ownerName ?? OWNERLESS,
    notes: l.notes ?? "",
    createdAt,
    lastActivityAt: l.lastActivityAt ?? createdAt,
    stageDates: (l.stageDates ?? []).map((d) => d ?? ""),
    customerId: str(l.customerId),
  };
}

export function mapCustomer(c: ApiCustomer): CustomerRecord {
  return {
    id: String(c.id),
    initials: c.initials,
    name: c.name,
    industry: c.industry,
    size: c.size ?? "",
    website: c.website ?? "",
    city: c.city ?? "",
    contacts: (c.contacts ?? []).map((p) => ({ name: p.name, title: p.jobTitle ?? "", email: p.email ?? "", phone: p.phone ?? "", primary: p.primary })),
    lifetimeValue: Number(c.lifetimeValue) || 0,
    legacyOpenDeals: c.legacyOpenDeals ?? 0,
    health: HEALTH[c.health] ?? "Healthy",
    owner: c.ownerName ?? OWNERLESS,
    since: localDate(c.since, "12:00:00"),
    leadId: str(c.leadId),
  };
}

export function mapDeal(d: ApiDeal): DealRecord {
  return {
    id: String(d.id),
    title: d.title,
    company: d.company,
    value: Number(d.value) || 0,
    tag: DEAL_TAG[d.temperature] ?? "Warm",
    stage: DEAL_STAGE[d.stage] ?? "New",
    probability: d.probability,
    closeDate: localDate(d.closeDate, "17:00:00"),
    owner: d.ownerName ?? OWNERLESS,
    next: d.nextStep ?? "",
    leadId: str(d.leadId),
    customerId: str(d.customerId),
    lostReason: d.lostReason ?? "",
    closedAt: d.closedAt,
  };
}

export function mapTask(t: ApiTask): TaskRecord {
  const createdAt = t.createdAt ?? new Date().toISOString();
  return {
    id: String(t.id),
    title: t.title,
    type: TASK_TYPE[t.type] ?? "To-do",
    priority: TASK_PRIORITY[t.priority] ?? "Medium",
    dueAt: t.dueAt ?? createdAt,
    reminder: (REMINDERS as string[]).includes(t.reminder) ? (t.reminder as ReminderOption) : "none",
    remindByEmail: t.remindByEmail,
    owner: t.ownerName ?? OWNERLESS,
    leadId: str(t.leadId),
    customerId: str(t.customerId),
    dealId: str(t.dealId),
    contact: t.contact ?? "",
    company: t.company ?? "",
    notes: t.notes ?? "",
    done: t.done,
    doneAt: t.doneAt,
    createdAt,
    createdBy: t.createdBy ?? "",
    followUps: (t.followUps ?? []).map((f) => ({
      id: String(f.id),
      at: f.at ?? createdAt,
      by: f.by ?? "",
      outcome: f.outcome,
      note: f.note ?? "",
      rescheduledTo: f.rescheduledTo,
    })),
  };
}

export function mapActivity(a: ApiActivity): ActivityRecord {
  return {
    id: String(a.id),
    kind: a.type as ActivityKind,
    title: a.title,
    meta: a.body ?? "",
    at: a.at ?? new Date().toISOString(),
    by: a.by,
    leadId: opt(a.leadId),
    customerId: opt(a.customerId),
    dealId: opt(a.dealId),
    taskId: opt(a.taskId),
    assignee: a.assigneeName ?? undefined,
  };
}

export function mapAudit(a: ApiAudit): AuditRecord {
  return {
    id: String(a.id),
    at: a.at ?? new Date().toISOString(),
    user: a.user,
    action: a.action as AuditAction,
    record: a.record,
    details: a.details ?? "",
  };
}
