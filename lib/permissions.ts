import type { PermissionRow, Role } from "@/types";
import type { SessionUser } from "@/lib/users";

/**
 * One place that decides who can do what. Matches the table on the
 * Team and roles page. The UI hides what a role can't do, and proxy.ts
 * blocks admin-only pages. The API enforces the same rules on every request
 * (backend/app/Policies and the Gates in AppServiceProvider).
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

export function can(user: Pick<SessionUser, "role"> | null, permission: Permission): boolean {
  if (!user) return false;
  return matrix[user.role].includes(permission);
}

/** Sales reps only see and change records they own. */
export function canSee(user: SessionUser | null, owner: string): boolean {
  if (!user) return false;
  return can(user, "viewAll") || owner === user.short;
}

export function canEdit(user: SessionUser | null, owner: string): boolean {
  if (!user) return false;
  return can(user, "editAny") || owner === user.short;
}

/** Routes only admins may open. proxy.ts redirects everyone else. */
export const adminOnlyRoutes = ["/team", "/audit-log"];

const row = (p: Permission) => ({
  admin: matrix.Admin.includes(p),
  manager: matrix.Manager.includes(p),
  rep: matrix["Sales rep"].includes(p),
});

/** The table shown on the Team and roles page, built from the same matrix. */
export const PERMISSION_TABLE: PermissionRow[] = [
  { label: "View all leads and customers", ...row("viewAll") },
  { label: "Edit and reassign leads", ...row("editAny") },
  { label: "Delete records", ...row("delete") },
  { label: "Export data", ...row("export") },
  { label: "Manage team and roles", ...row("manageTeam") },
  { label: "View audit log", ...row("viewAudit") },
];
