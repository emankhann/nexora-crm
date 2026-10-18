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
export type SessionUser = {
  /** Database id of the user, as a string. */
  id: string;
  name: string;
  /** Short display name, e.g. "Huma K.". Not unique: records point to owners by `id`. */
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

const ROLE_BY_KEY: Record<string, Role> = { admin: "Admin", manager: "Manager", sales_rep: "Sales rep" };
const KEY_BY_ROLE: Record<Role, string> = { Admin: "admin", Manager: "manager", "Sales rep": "sales_rep" };

export function roleFromKey(key: string | null | undefined): Role | null {
  return key ? ROLE_BY_KEY[key] ?? null : null;
}

export function roleKey(role: Role): string {
  return KEY_BY_ROLE[role];
}

let directory: SessionUser[] = [];

/** Called by the CRM store with the active team members from the API. */
export function setDirectory(people: SessionUser[]) {
  directory = people;
}

/** Everyone who can sign in and own records, in the order the API returned them. */
export function getUsers(): SessionUser[] {
  return directory;
}

/** The owner id meaning "nobody", on records and in owner pickers. */
export const NO_OWNER = "";

/** Owner filter value meaning "anyone" (user ids are numbers, so it can't clash). */
export const ANY_OWNER = "*";

export type OwnerOption = { value: string; label: string };

export function userById(id: string): SessionUser | null {
  return id === NO_OWNER ? null : directory.find((u) => u.id === id) ?? null;
}

/**
 * How a person is named in pickers and filters: their short name, plus their email
 * when someone else on the team has the same short name, so the two can be told apart.
 */
export function ownerLabel(user: SessionUser): string {
  const shared = directory.some((u) => u.id !== user.id && u.short === user.short);
  return shared ? `${user.short} (${user.email})` : user.short;
}

/** Owner picker choices: value is the user id, label is the name shown. */
export function getOwnerOptions({ unassigned = true }: { unassigned?: boolean } = {}): OwnerOption[] {
  const people = directory.map((u) => ({ value: u.id, label: ownerLabel(u) }));
  return unassigned ? [...people, { value: NO_OWNER, label: "Unassigned" }] : people;
}

/** A single picker choice for this owner id, for people who can't reassign (the picker is locked to it). */
export function ownerOption(ownerId: string): OwnerOption {
  const u = userById(ownerId);
  return { value: ownerId, label: u ? ownerLabel(u) : "Unassigned" };
}

export function initialsForOwner(ownerId: string): string {
  return userById(ownerId)?.initials ?? "–";
}
