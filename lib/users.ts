import type { Role } from "@/types";

/**
 * People who can sign in and own records.
 *
 * The list comes from the database (GET /api/crm → members) and is filled in by the
 * CRM store when it loads, via setDirectory(). Components read it with getUsers() /
 * getOwnerOptions() while rendering, which always happens after the store has loaded.
 *
 * Shared by the browser and by proxy.ts, so it must not import anything browser- or server-only.
 */
export type DemoUser = {
  /** Database id of the user, as a string. */
  id: string;
  name: string;
  /** Short name used as the owner on leads, deals and tasks, e.g. "Huma K." */
  short: string;
  initials: string;
  email: string;
  role: Role;
};

/**
 * Optimistic "who is signed in" hint for proxy.ts, set by the browser after sign-in.
 * Holds only the role (admin / manager / sales_rep) so the proxy can redirect early.
 * It proves nothing: the API checks the real httpOnly Laravel session on every request.
 */
export const SESSION_HINT_COOKIE = "nexora_session";

/** Demo accounts created by the database seeder (php artisan migrate:fresh --seed). */
export const DEMO_PASSWORD = "demo1234";
export const DEMO_ACCOUNTS = [
  { email: "huma@nexora.example", label: "Admin", sub: "Full access" },
  { email: "omar@nexora.example", label: "Manager", sub: "Team view" },
  { email: "sana@nexora.example", label: "Sales rep", sub: "Own leads" },
];

const ROLE_BY_KEY: Record<string, Role> = { admin: "Admin", manager: "Manager", sales_rep: "Sales rep" };
const KEY_BY_ROLE: Record<Role, string> = { Admin: "admin", Manager: "manager", "Sales rep": "sales_rep" };

export function roleFromKey(key: string | null | undefined): Role | null {
  return key ? ROLE_BY_KEY[key] ?? null : null;
}

export function roleKey(role: Role): string {
  return KEY_BY_ROLE[role];
}

let directory: DemoUser[] = [];

/** Called by the CRM store with the active team members from the API. */
export function setDirectory(people: DemoUser[]) {
  directory = people;
}

/** Everyone who can sign in and own records, in the order the API returned them. */
export function getUsers(): DemoUser[] {
  return directory;
}

/** Names that can own a record, in the order they appear in owner pickers. */
export function getOwnerOptions(): string[] {
  return [...directory.map((u) => u.short), "Unassigned"];
}

export function userByShort(short: string): DemoUser | null {
  return directory.find((u) => u.short === short) ?? null;
}

export function initialsForOwner(short: string): string {
  return userByShort(short)?.initials ?? "–";
}
