import type { Tone } from "@/components/ui/Badge";

export type Stat = { label: string; value: string; delta: string; tone: Tone };
export type MonthRevenue = { month: string; amount: number };
export type FunnelStep = { name: string; count: number; won?: boolean };

export type HotLead = {
  id: string;
  initials: string;
  name: string;
  company: string;
  stage: string;
  scoreLabel: string;
  tone: Tone;
  owner: string;
  value: number;
};

export type Task = {
  id: string;
  title: string;
  meta: string;
  priority: "Urgent" | "High" | "Low";
};

export type Attention = { id: string; text: string; tone: "hot" | "warm" | "cold" };
export type Activity = { id: string; text: string; time: string };

export type DashboardData = {
  stats: Stat[];
  revenue: MonthRevenue[];
  funnel: FunnelStep[];
  hotLeads: HotLead[];
  tasks: Task[];
  attention: Attention[];
  activity: Activity[];
};

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Unqualified" | "Converted";

export type Lead = {
  id: string;
  initials: string;
  name: string;
  email: string;
  company: string;
  source: string;
  status: LeadStatus;
  score: number;
  owner: string;
  lastActivity: string;
};

export type ScoreFactor = { label: string; points: number };

export type TimelineKind = "proposal" | "email" | "call" | "status" | "created" | "note" | "meeting";
export type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  title: string;
  meta: string;
  time: string;
};

export type LinkedDeal = {
  name: string;
  value: number;
  stage: string;
  chance: number;
  expected: string;
};

export type LeadTask = { id: string; title: string; due: string };

export type LeadDetail = Lead & {
  title: string;
  phone: string;
  created: string;
  stageDates: string[];
  factors: ScoreFactor[];
  timeline: TimelineEvent[];
  deal: LinkedDeal | null;
  tasks: LeadTask[];
};

export type LeadExtras = Omit<LeadDetail, keyof Lead>;

export type Health = "Healthy" | "Watch" | "At risk";

export type Customer = {
  id: string;
  initials: string;
  name: string;
  contact: string;
  industry: string;
  lifetimeValue: number;
  openDeals: number;
  health: Health;
  owner: string;
  since: string;
};

export type CustomersSummary = {
  total: number;
  newThisMonth: number;
  lifetimeValue: number;
  atRisk: number;
};

export type CustomersData = { summary: CustomersSummary; customers: Customer[] };

export type DealStage = "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost";
export type DealTag = "Hot" | "Warm" | "New" | "Cold";

export type Deal = {
  id: string;
  title: string;
  company: string;
  value: number;
  tag: DealTag;
  stage: DealStage;
  ownerInitials: string;
  next: string;
};

export type PipelineData = {
  summary: { activeDeals: number; totalValue: number };
  deals: Deal[];
};

export type AppUser = {
  name: string;
  initials: string;
  role: string;
  leadOwner: string;
};

export type TaskBucket = "overdue" | "today" | "upcoming";

export type TaskItem = {
  id: string;
  title: string;
  leadId?: string;
  contact: string;
  company: string;
  due: string;
  bucket: TaskBucket;
  priority: "Urgent" | "High" | "Low";
  ownerInitials: string;
  done: boolean;
};

export type Kpi = { label: string; value: string; note: string };
export type SourceShare = { name: string; percent: number };
export type RepPerformance = { id: string; name: string; leads: number; won: number; revenue: number };
export type ReportsData = {
  kpis: Kpi[];
  revenue: MonthRevenue[];
  sources: SourceShare[];
  reps: RepPerformance[];
};

export type Role = "Admin" | "Manager" | "Sales rep";
export type MemberStatus = "Active" | "Pending";
export type Member = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  leads: number | null;
  lastActive: string;
  status: MemberStatus;
};
export type PermissionRow = { label: string; admin: boolean; manager: boolean; rep: boolean };
export type TeamData = { members: Member[]; permissions: PermissionRow[] };

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
/* Records used by the client-side CRM store (lib/crm-store.ts).       */
/* Dates are ISO strings so they can be sorted, compared and saved.    */
/* When the database is added these become the API/DB shapes.         */
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
