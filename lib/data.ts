import {
  currentUserMock,
  dashboardMock,
  leadsMock,
  leadDetailsMock,
  customersMock,
  pipelineMock,
  tasksMock,
  reportsMock,
  teamMock,
  auditMock,
} from "./mock-data";
import type {
  AuditEvent,
  AppUser,
  CustomersData,
  DashboardData,
  Lead,
  LeadDetail,
  LeadExtras,
  PipelineData,
  TaskItem,
  ReportsData,
  TeamData,
} from "@/types";

const apiBaseUrl = process.env.NEXORA_API_URL?.replace(/\/+$/, "");

async function fromBackend<T>(path: string): Promise<T | undefined> {
  if (!apiBaseUrl) return undefined;

  const response = await fetch(`${apiBaseUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`CRM API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fromBackendOrMock<T>(path: string, mock: T): Promise<T> {
  const data = await fromBackend<T>(path);
  return data === undefined ? mock : data;
}

export async function getCurrentUser(): Promise<AppUser> {
  return fromBackendOrMock("/me", currentUserMock);
}

export async function getDashboard(): Promise<DashboardData> {
  return fromBackendOrMock("/dashboard", dashboardMock);
}

export async function getLeads(): Promise<Lead[]> {
  return fromBackendOrMock("/leads", leadsMock);
}

// Leads without hand-written detail data get this simple fallback.
function fallbackExtras(lead: Lead): LeadExtras {
  return {
    title: "Contact",
    phone: "Not added",
    created: "Not recorded",
    stageDates: [],
    factors: [],
    timeline: [
      { id: "created", kind: "created", title: "Lead created", meta: `Source: ${lead.source}`, time: "Earlier" },
    ],
    deal: null,
    tasks: [],
  };
}

export async function getLead(id: string): Promise<LeadDetail | null> {
  const backendLead = await fromBackend<LeadDetail | null>(`/leads/${encodeURIComponent(id)}`);
  if (backendLead !== undefined) return backendLead;

  const lead = leadsMock.find((l) => l.id === id);
  if (!lead) return null;
  return { ...lead, ...(leadDetailsMock[id] ?? fallbackExtras(lead)) };
}

export async function getCustomers(): Promise<CustomersData> {
  return fromBackendOrMock("/customers", customersMock);
}

export async function getPipeline(): Promise<PipelineData> {
  return fromBackendOrMock("/pipeline", pipelineMock);
}

export async function getTasks(): Promise<TaskItem[]> {
  return fromBackendOrMock("/tasks", tasksMock);
}

export async function getReports(): Promise<ReportsData> {
  return fromBackendOrMock("/reports", reportsMock);
}

export async function getTeam(): Promise<TeamData> {
  return fromBackendOrMock("/team", teamMock);
}

export async function getAuditLog(): Promise<AuditEvent[]> {
  return fromBackendOrMock("/audit-log", auditMock);
}
