export type MonthRevenue = { month: string; amount: number };

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Unqualified" | "Converted";

export type ScoreFactor = { label: string; points: number };

export type TimelineKind = "proposal" | "email" | "call" | "status" | "created" | "note" | "meeting";

export type Health = "Healthy" | "Watch" | "At risk";

export type DealStage = "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost";
export type DealTag = "Hot" | "Warm" | "New" | "Cold";

export type Role = "Admin" | "Manager" | "Sales rep";
export type MemberStatus = "Active" | "Pending";
export type PermissionRow = { label: string; admin: boolean; manager: boolean; rep: boolean };

export type AuditAction =
  | "Converted"
  | "Note added"
  | "Reassigned"
  | "Status changed"
  | "Call logged"
  | "Role changed"
  | "Created"
  | "Updated"
  | "Deleted"
  | "Deal moved"
  | "Task created"
  | "Task completed"
  | "Signed in";
export type AuditEvent = {
  id: string;
  when: string;
  user: string;
  action: AuditAction;
  record: string;
  details: string;
};

/* ------------------------------------------------------------------ */
/* Records used by the CRM store (lib/crm-store.ts), made from the     */
/* API's JSON by lib/api-mappers.ts. Dates are ISO strings so they can */
/* be sorted and compared.                                             */
/* ------------------------------------------------------------------ */

export type LeadSource = "Referral" | "Website" | "LinkedIn" | "Event" | "Cold email";

export type LeadRecord = {
  id: string;
  initials: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  company: string;
  companySize: string;
  source: LeadSource;
  status: LeadStatus;
  score: number;
  factors: ScoreFactor[];
  /** true when the score is worked out by Nexora's rules (new leads). */
  autoScore: boolean;
  /** Short owner name such as "Huma K.", or "Unassigned". */
  owner: string;
  notes: string;
  createdAt: string;
  lastActivityAt: string;
  stageDates: string[];
  customerId: string | null;
};

export type ActivityKind = TimelineKind | "assigned" | "converted" | "deal";

export type ActivityRecord = {
  id: string;
  kind: ActivityKind;
  title: string;
  meta: string;
  at: string;
  by: string;
  leadId?: string;
  customerId?: string;
  dealId?: string;
  taskId?: string;
  /** For "assigned" events: the short name of the person who received it. */
  assignee?: string;
};

export type ContactPerson = {
  name: string;
  title: string;
  email: string;
  phone: string;
  primary: boolean;
};

export type CustomerRecord = {
  id: string;
  initials: string;
  name: string;
  industry: string;
  size: string;
  website: string;
  city: string;
  contacts: ContactPerson[];
  lifetimeValue: number;
  /** Open deals from before Nexora (seed data). New deals are counted live. */
  legacyOpenDeals: number;
  health: Health;
  owner: string;
  since: string;
  leadId: string | null;
};

export type DealRecord = {
  id: string;
  title: string;
  company: string;
  value: number;
  tag: DealTag;
  stage: DealStage;
  probability: number;
  closeDate: string;
  owner: string;
  next: string;
  leadId: string | null;
  customerId: string | null;
  lostReason: string;
  closedAt: string | null;
};

export type TaskPriority = "Urgent" | "High" | "Medium" | "Low";
export type TaskType = "Call" | "Email" | "Meeting" | "To-do";
export type ReminderOption = "none" | "15m" | "1h" | "1d";

export type FollowUp = {
  id: string;
  at: string;
  by: string;
  outcome: string;
  note: string;
  rescheduledTo: string | null;
};

export type TaskRecord = {
  id: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  dueAt: string;
  reminder: ReminderOption;
  remindByEmail: boolean;
  owner: string;
  leadId: string | null;
  customerId: string | null;
  dealId: string | null;
  contact: string;
  company: string;
  notes: string;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
  createdBy: string;
  followUps: FollowUp[];
};

export type AuditRecord = {
  id: string;
  at: string;
  user: string;
  action: AuditAction;
  record: string;
  details: string;
};

export type MemberRecord = {
  id: string;
  /** Demo login id (u1, u2…) for people who can sign in; null for pending invites. */
  userId: string | null;
  name: string;
  short: string;
  initials: string;
  email: string;
  role: Role;
  status: MemberStatus;
  invitedAt: string | null;
  lastActiveAt: string | null;
};
