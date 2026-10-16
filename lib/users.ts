import type { Role } from "@/types";

/**
 * Demo accounts for the frontend-first build.
 *
 * Shared by the browser (login form, sidebar) and by proxy.ts (route checks),
 * so it must not import anything browser- or server-only.
 * When the database is added, these rows move to the users table and the
 * password check moves to the server (hashed with bcrypt).
 */
export type DemoUser = {
  id: string;
  name: string;
  /** Short name used as the owner on leads, deals and tasks, e.g. "Huma K." */
  short: string;
  initials: string;
  email: string;
  role: Role;
};

export const DEMO_PASSWORD = "demo1234";
export const SESSION_COOKIE = "nexora_user";
/** Role changes made on the Team page (frontend-only), as JSON {userId: role}. */
export const ROLES_COOKIE = "nexora_roles";

export const users: DemoUser[] = [
  { id: "u1", name: "Huma Khan", short: "Huma K.", initials: "HK", email: "huma@nexora.example", role: "Admin" },
  { id: "u2", name: "Omar Tariq", short: "Omar T.", initials: "OT", email: "omar@nexora.example", role: "Manager" },
  { id: "u3", name: "Sana Mirza", short: "Sana M.", initials: "SM", email: "sana@nexora.example", role: "Sales rep" },
];

export function findUserById(id: string | null | undefined): DemoUser | null {
  if (!id) return null;
  return users.find((u) => u.id === id) ?? null;
}

const ROLES: Role[] = ["Admin", "Manager", "Sales rep"];

export function parseRoleOverrides(raw: string | null | undefined): Record<string, Role> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, string>;
    const out: Record<string, Role> = {};
    for (const [id, role] of Object.entries(parsed)) if (ROLES.includes(role as Role)) out[id] = role as Role;
    return out;
  } catch {
    return {};
  }
}

/** The user with any role change from the Team page applied. */
export function withRole(user: DemoUser | null, overrides: Record<string, Role>): DemoUser | null {
  if (!user || !overrides[user.id] || overrides[user.id] === user.role) return user;
  return { ...user, role: overrides[user.id] };
}

export function findUserByEmail(email: string): DemoUser | null {
  const e = email.trim().toLowerCase();
  return users.find((u) => u.email === e) ?? null;
}

export function userByShort(short: string): DemoUser | null {
  return users.find((u) => u.short === short) ?? null;
}

export function initialsForOwner(short: string): string {
  return userByShort(short)?.initials ?? "–";
}

/** Names that can own a record, in the order they appear in owner pickers. */
export const ownerOptions = [...users.map((u) => u.short), "Unassigned"];
