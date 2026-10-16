import type { Role } from "@/types";
import type { DemoUser } from "@/lib/users";

/**
 * One place that decides who can do what. Matches the table on the
 * Team and roles page. The UI hides what a role can't do, and proxy.ts
 * blocks admin-only pages. When the API is added, the same checks run there.
 */
export type Permission =
  | "viewAll"
  | "editAny"
  | "reassign"
  | "delete"
  | "export"
  | "manageTeam"
  | "viewAudit";

const matrix: Record<Role, Permission[]> = {
  Admin: ["viewAll", "editAny", "reassign", "delete", "export", "manageTeam", "viewAudit"],
  Manager: ["viewAll", "editAny", "reassign", "export"],
  "Sales rep": [],
};

export function can(user: Pick<DemoUser, "role"> | null, permission: Permission): boolean {
  if (!user) return false;
  return matrix[user.role].includes(permission);
}

/** Sales reps only see and change records they own. */
export function canSee(user: DemoUser | null, owner: string): boolean {
  if (!user) return false;
  return can(user, "viewAll") || owner === user.short;
}

export function canEdit(user: DemoUser | null, owner: string): boolean {
  if (!user) return false;
  return can(user, "editAny") || owner === user.short;
}

/** Routes only admins may open. proxy.ts redirects everyone else. */
export const adminOnlyRoutes = ["/team", "/audit-log"];
