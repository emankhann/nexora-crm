import type {
  AppUser,
  DashboardData,
  Lead,
  LeadExtras,
  CustomersData,
  PipelineData,
  TaskItem,
  ReportsData,
  TeamData,
  AuditEvent,
} from "@/types";

export const currentUserMock: AppUser = {
  name: "Huma Khan",
  initials: "HK",
  role: "Admin",
  leadOwner: "Huma K.",
};

export const dashboardMock: DashboardData = {
  stats: [
    { label: "Total leads", value: "248", delta: "+12% this month", tone: "ok" },
    { label: "Active deals", value: "9", delta: "+2 this week", tone: "ok" },
    { label: "Won this month", value: "$22,600", delta: "+8.4% vs last month", tone: "ok" },
    { label: "Lead conversion", value: "18.4%", delta: "-1.2% vs last month", tone: "hot" },
  ],
  revenue: [
    { month: "Nov", amount: 11200 },
    { month: "Dec", amount: 12400 },
    { month: "Jan", amount: 11400 },
    { month: "Feb", amount: 15000 },
    { month: "Mar", amount: 16200 },
    { month: "Apr", amount: 15400 },
    { month: "May", amount: 19000 },
    { month: "Jun", amount: 20600 },
    { month: "Jul", amount: 19600 },
    { month: "Aug", amount: 21800 },
    { month: "Sep", amount: 22200 },
    { month: "Oct", amount: 22600 },
  ],
  funnel: [
    { name: "New", count: 82 },
    { name: "Contacted", count: 54 },
    { name: "Qualified", count: 31 },
    { name: "Proposal", count: 18 },
    { name: "Won", count: 9, won: true },
  ],
  hotLeads: [
    { id: "1", initials: "AR", name: "Ayesha Raza", company: "Cedar Logistics", stage: "Proposal", scoreLabel: "Hot 92", tone: "hot", owner: "Huma K.", value: 12500 },
    { id: "2", initials: "BS", name: "Bilal Siddiqui", company: "Northwind Retail", stage: "Qualified", scoreLabel: "Hot 85", tone: "hot", owner: "Omar T.", value: 8900 },
    { id: "3", initials: "MN", name: "Maryam Noor", company: "Brightpath Clinics", stage: "Contacted", scoreLabel: "Warm 64", tone: "warm", owner: "Huma K.", value: 5400 },
    { id: "4", initials: "DA", name: "Daniyal Ahmed", company: "Orbit Studios", stage: "Converted", scoreLabel: "Won", tone: "ok", owner: "Sana M.", value: 15000 },
    { id: "5", initials: "ZH", name: "Zainab Hussain", company: "Lumen Foods", stage: "Qualified", scoreLabel: "Warm 58", tone: "warm", owner: "Omar T.", value: 4200 },
  ],
  tasks: [
    { id: "1", title: "Send proposal to Cedar Logistics", meta: "Due 5:00 PM · Ayesha Raza", priority: "Urgent" },
    { id: "2", title: "Follow-up call with Northwind", meta: "Due 3:30 PM · Bilal Siddiqui", priority: "High" },
    { id: "3", title: "Prepare demo for Brightpath", meta: "Due 7:00 PM · Maryam Noor", priority: "High" },
    { id: "4", title: "Update contact details for Orbit", meta: "Due 6:00 PM · Daniyal Ahmed", priority: "Low" },
  ],
  attention: [
    { id: "1", text: "3 hot leads have had no contact for 7 days", tone: "hot" },
    { id: "2", text: "Cedar Logistics proposal is due today", tone: "warm" },
    { id: "3", text: "Pixel Foods deal has been in Qualified for 14 days", tone: "cold" },
  ],
  activity: [
    { id: "1", text: "Daniyal Ahmed converted to customer: Orbit Studios", time: "12 minutes ago" },
    { id: "2", text: "Omar T. added a note on Northwind Retail", time: "1 hour ago" },
    { id: "3", text: "New lead Zainab Hussain assigned to Omar T.", time: "3 hours ago" },
    { id: "4", text: "Proposal drafted for Cedar Logistics", time: "Yesterday" },
  ],
};

export const leadsMock: Lead[] = [
  { id: "1", initials: "AR", name: "Ayesha Raza", email: "ayesha@cedarlogistics.example", company: "Cedar Logistics", source: "Referral", status: "Qualified", score: 92, owner: "Huma K.", lastActivity: "2 hours ago" },
  { id: "2", initials: "BS", name: "Bilal Siddiqui", email: "bilal@northwind.example", company: "Northwind Retail", source: "Website", status: "Qualified", score: 85, owner: "Omar T.", lastActivity: "5 hours ago" },
  { id: "3", initials: "HB", name: "Hira Baig", email: "hira@pixelfoods.example", company: "Pixel Foods", source: "LinkedIn", status: "Qualified", score: 71, owner: "Sana M.", lastActivity: "Yesterday" },
  { id: "4", initials: "MN", name: "Maryam Noor", email: "maryam@brightpath.example", company: "Brightpath Clinics", source: "LinkedIn", status: "Contacted", score: 64, owner: "Huma K.", lastActivity: "Yesterday" },
  { id: "5", initials: "HQ", name: "Hamza Qureshi", email: "hamza@deltahardware.example", company: "Delta Hardware", source: "Website", status: "Contacted", score: 61, owner: "Omar T.", lastActivity: "2 days ago" },
  { id: "6", initials: "ZH", name: "Zainab Hussain", email: "zainab@lumenfoods.example", company: "Lumen Foods", source: "Event", status: "Qualified", score: 58, owner: "Omar T.", lastActivity: "2 days ago" },
  { id: "7", initials: "UT", name: "Usman Tariq", email: "usman@kitetravel.example", company: "Kite Travel", source: "Referral", status: "New", score: 47, owner: "Unassigned", lastActivity: "3 days ago" },
  { id: "8", initials: "SI", name: "Sara Iqbal", email: "sara@harbordental.example", company: "Harbor Dental", source: "Cold email", status: "New", score: 42, owner: "Sana M.", lastActivity: "4 days ago" },
  { id: "9", initials: "FA", name: "Fahad Ali", email: "fahad@greenleaf.example", company: "Greenleaf Cafe", source: "Cold email", status: "Unqualified", score: 18, owner: "Omar T.", lastActivity: "9 days ago" },
];

export const leadDetailsMock: Record<string, LeadExtras> = {
  "1": {
    title: "Operations Director",
    phone: "+92 300 555 0142",
    created: "Oct 6, 2026",
    stageDates: ["Oct 6", "Oct 8", "Oct 14"],
    factors: [
      { label: "Budget confirmed on call", points: 25 },
      { label: "Company size: 200 or more employees", points: 20 },
      { label: "Visited pricing page 3 times", points: 18 },
      { label: "Opened the last 3 emails", points: 15 },
      { label: "Decision maker (Operations Director)", points: 14 },
    ],
    timeline: [
      { id: "t1", kind: "proposal", title: "Proposal drafted for Fleet tracking portal", meta: "Huma K. · Attached: proposal v1", time: "2 hours ago" },
      { id: "t2", kind: "email", title: "Opened email: Fleet tracking proposal outline", meta: "Opened 3 times · Clicked pricing link", time: "5 hours ago" },
      { id: "t3", kind: "call", title: "Call logged (18 min): confirmed budget and timeline", meta: "Huma K. · Budget approved, wants a rollout by January", time: "Yesterday" },
      { id: "t4", kind: "status", title: "Status changed from Contacted to Qualified", meta: "Huma K.", time: "Yesterday" },
      { id: "t5", kind: "created", title: "Lead created from a referral", meta: "Referred by Sana M. · Added by System", time: "Oct 6" },
    ],
    deal: { name: "Fleet tracking portal", value: 12500, stage: "Proposal", chance: 65, expected: "Oct 28" },
    tasks: [
      { id: "k1", title: "Send proposal to Cedar Logistics", due: "Today, 5:00 PM" },
      { id: "k2", title: "Schedule kickoff call", due: "Oct 19" },
    ],
  },
};

export const customersMock: CustomersData = {
  summary: { total: 64, newThisMonth: 3, lifetimeValue: 412800, atRisk: 5 },
  customers: [
    { id: "1", initials: "OS", name: "Orbit Studios", contact: "Daniyal Ahmed", industry: "Design agency", lifetimeValue: 15000, openDeals: 1, health: "Healthy", owner: "Sana M.", since: "Oct 14, 2026" },
    { id: "2", initials: "AP", name: "Aster Pharma", contact: "Rabia Anwar", industry: "Healthcare", lifetimeValue: 7600, openDeals: 0, health: "Healthy", owner: "Huma K.", since: "Oct 9, 2026" },
    { id: "3", initials: "MT", name: "Meridian Textiles", contact: "Kamran Shah", industry: "Manufacturing", lifetimeValue: 48000, openDeals: 2, health: "Healthy", owner: "Omar T.", since: "Mar 3, 2026" },
    { id: "4", initials: "SL", name: "Summit Logistics", contact: "Nida Farooq", industry: "Logistics", lifetimeValue: 31500, openDeals: 1, health: "At risk", owner: "Omar T.", since: "Jan 21, 2026" },
    { id: "5", initials: "IS", name: "Indus Software", contact: "Asad Mehmood", industry: "Software", lifetimeValue: 27900, openDeals: 1, health: "Healthy", owner: "Huma K.", since: "Feb 12, 2026" },
    { id: "6", initials: "ZC", name: "Zenith Clinics", contact: "Dr. Mehwish Ali", industry: "Healthcare", lifetimeValue: 19800, openDeals: 1, health: "Watch", owner: "Sana M.", since: "Apr 30, 2026" },
    { id: "7", initials: "FA", name: "Falcon Auto", contact: "Tahir Javed", industry: "Retail", lifetimeValue: 12400, openDeals: 0, health: "At risk", owner: "Omar T.", since: "Dec 8, 2025" },
    { id: "8", initials: "CB", name: "Crescent Bakery", contact: "Farah Naseem", industry: "Food and beverage", lifetimeValue: 6200, openDeals: 0, health: "Healthy", owner: "Sana M.", since: "Aug 18, 2026" },
  ],
};

export const pipelineMock: PipelineData = {
  summary: { activeDeals: 37, totalValue: 186400 },
  deals: [
    { id: "1", title: "Website redesign", company: "Lumen Foods", value: 4200, tag: "Warm", stage: "New", ownerInitials: "OT", next: "Follow up Oct 18" },
    { id: "2", title: "CRM onboarding", company: "Harbor Dental", value: 2800, tag: "New", stage: "New", ownerInitials: "SM", next: "Follow up Oct 20" },
    { id: "3", title: "Support retainer", company: "Kite Travel", value: 3500, tag: "New", stage: "New", ownerInitials: "HK", next: "Follow up Oct 21" },
    { id: "4", title: "Clinic booking portal", company: "Brightpath Clinics", value: 5400, tag: "Warm", stage: "Contacted", ownerInitials: "HK", next: "Call Oct 17" },
    { id: "5", title: "Inventory dashboard", company: "Delta Hardware", value: 6100, tag: "Warm", stage: "Contacted", ownerInitials: "OT", next: "Call Oct 19" },
    { id: "6", title: "Retail analytics suite", company: "Northwind Retail", value: 8900, tag: "Hot", stage: "Qualified", ownerInitials: "OT", next: "Demo Oct 16" },
    { id: "7", title: "Mobile app MVP", company: "Pixel Foods", value: 11000, tag: "Warm", stage: "Qualified", ownerInitials: "SM", next: "Demo Oct 22" },
    { id: "8", title: "Fleet tracking portal", company: "Cedar Logistics", value: 12500, tag: "Hot", stage: "Proposal", ownerInitials: "HK", next: "Send today" },
    { id: "9", title: "Booking engine", company: "Kite Travel", value: 9300, tag: "Warm", stage: "Proposal", ownerInitials: "SM", next: "Review Oct 21" },
  ],
};

export const tasksMock: TaskItem[] = [
  { id: "1", title: "Send proposal to Cedar Logistics", leadId: "1", contact: "Ayesha Raza", company: "Cedar Logistics", due: "Today, 5:00 PM", bucket: "today", priority: "Urgent", ownerInitials: "HK", done: false },
  { id: "2", title: "Follow-up call with Northwind", leadId: "2", contact: "Bilal Siddiqui", company: "Northwind Retail", due: "Today, 3:30 PM", bucket: "today", priority: "High", ownerInitials: "OT", done: false },
  { id: "3", title: "Prepare demo for Brightpath", leadId: "4", contact: "Maryam Noor", company: "Brightpath Clinics", due: "Today, 7:00 PM", bucket: "today", priority: "High", ownerInitials: "HK", done: false },
  { id: "4", title: "Update contact details for Orbit", contact: "Daniyal Ahmed", company: "Orbit Studios", due: "Today, 6:00 PM", bucket: "today", priority: "Low", ownerInitials: "SM", done: false },
  { id: "5", title: "Reply to Pixel Foods pricing question", leadId: "3", contact: "Hira Baig", company: "Pixel Foods", due: "Oct 13", bucket: "overdue", priority: "High", ownerInitials: "SM", done: false },
  { id: "6", title: "Schedule kickoff call", leadId: "1", contact: "Ayesha Raza", company: "Cedar Logistics", due: "Oct 19", bucket: "upcoming", priority: "High", ownerInitials: "HK", done: false },
  { id: "7", title: "Log intro call with Hira Baig", leadId: "3", contact: "Hira Baig", company: "Pixel Foods", due: "Oct 14", bucket: "today", priority: "Low", ownerInitials: "SM", done: true },
  { id: "8", title: "Send intro email to Kite Travel", leadId: "7", contact: "Usman Tariq", company: "Kite Travel", due: "Oct 13", bucket: "overdue", priority: "Low", ownerInitials: "OT", done: true },
];

export const reportsMock: ReportsData = {
  kpis: [
    { label: "Revenue won", value: "$22,600", note: "+8.4% vs last month" },
    { label: "Lead conversion", value: "18.4%", note: "-1.2% vs last month" },
    { label: "Average deal size", value: "$11,500", note: "Across 18 deals won" },
    { label: "Sales cycle", value: "21 days", note: "From new lead to won" },
  ],
  revenue: [
    { month: "Nov", amount: 11200 }, { month: "Dec", amount: 12400 },
    { month: "Jan", amount: 11400 }, { month: "Feb", amount: 15000 },
    { month: "Mar", amount: 16200 }, { month: "Apr", amount: 15400 },
    { month: "May", amount: 19000 }, { month: "Jun", amount: 20600 },
    { month: "Jul", amount: 19600 }, { month: "Aug", amount: 21800 },
    { month: "Sep", amount: 22200 }, { month: "Oct", amount: 22600 },
  ],
  sources: [
    { name: "Referral", percent: 38 },
    { name: "Website", percent: 27 },
    { name: "LinkedIn", percent: 18 },
    { name: "Event", percent: 10 },
    { name: "Cold email", percent: 7 },
  ],
  reps: [
    { id: "1", name: "Huma K.", leads: 64, won: 8, revenue: 84200 },
    { id: "2", name: "Omar T.", leads: 98, won: 5, revenue: 61300 },
    { id: "3", name: "Sana M.", leads: 86, won: 5, revenue: 61900 },
  ],
};

export const teamMock: TeamData = {
  members: [
    { id: "1", name: "Huma Khan", initials: "HK", email: "huma@nexora.example", role: "Admin", leads: 64, lastActive: "Just now", status: "Active" },
    { id: "2", name: "Omar T.", initials: "OT", email: "omar@nexora.example", role: "Manager", leads: 98, lastActive: "2 hours ago", status: "Active" },
    { id: "3", name: "Sana M.", initials: "SM", email: "sana@nexora.example", role: "Sales rep", leads: 86, lastActive: "Yesterday", status: "Active" },
    { id: "4", name: "kamran@nexora.example", initials: "K", email: "kamran@nexora.example", role: "Sales rep", leads: null, lastActive: "Invited Oct 15", status: "Pending" },
  ],
  permissions: [
    { label: "View all leads and customers", admin: true, manager: true, rep: false },
    { label: "Edit and reassign leads", admin: true, manager: true, rep: false },
    { label: "Delete records", admin: true, manager: false, rep: false },
    { label: "Export data", admin: true, manager: true, rep: false },
    { label: "Manage team and roles", admin: true, manager: false, rep: false },
    { label: "View audit log", admin: true, manager: false, rep: false },
  ],
};

export const auditMock: AuditEvent[] = [
  { id: "1", when: "12 minutes ago", user: "Sana M.", action: "Converted", record: "Orbit Studios", details: "Daniyal Ahmed became a customer" },
  { id: "2", when: "1 hour ago", user: "Omar T.", action: "Note added", record: "Northwind Retail", details: "Note on Bilal Siddiqui" },
  { id: "3", when: "3 hours ago", user: "Huma K.", action: "Reassigned", record: "Zainab Hussain", details: "Owner changed to Omar T." },
  { id: "4", when: "Yesterday", user: "Huma K.", action: "Status changed", record: "Ayesha Raza", details: "Contacted to Qualified" },
  { id: "5", when: "Yesterday", user: "Huma K.", action: "Call logged", record: "Ayesha Raza", details: "18 min: budget and timeline confirmed" },
  { id: "6", when: "Oct 14", user: "Admin", action: "Role changed", record: "Omar T.", details: "Sales rep to Manager" },
  { id: "7", when: "Oct 6", user: "System", action: "Created", record: "Ayesha Raza", details: "Lead added from a referral by Sana M." },
];
