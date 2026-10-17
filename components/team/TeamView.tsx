"use client";

import { useState, type FormEvent } from "react";
import { Check, Mail, Minus, UserPlus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SelectField, TextField, type Errors } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import { changeMemberRole, inviteMember, resendInvite, revokeInvite, useCrm } from "@/lib/crm-store";
import { setRoleOverride, useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary, card, selectCls } from "@/lib/ui";
import { isEmail, timeAgo } from "@/lib/utils";
import type { MemberRecord, PermissionRow, Role } from "@/types";

const ROLES: Role[] = ["Admin", "Manager", "Sales rep"];
const roleTone = { Admin: "cold", Manager: "warm", "Sales rep": "ok" } as const;
const roleNote = { Admin: "Full access", Manager: "Team view", "Sales rep": "Own leads" } as const;
const statusTone = { Active: "ok", Pending: "warm" } as const;
const MEMBER_GRID = "grid grid-cols-[2fr_2.2fr_1.3fr_0.7fr_1.1fr_0.9fr_1.2fr] items-center gap-3";
const PERM_GRID = "grid grid-cols-[3fr_1fr_1fr_1fr] items-center gap-3";

function Tick({ on }: { on: boolean }) {
  return on ? (
    <Check size={18} strokeWidth={2.5} className="mx-auto text-[#5EEB9C]" aria-label="Allowed" />
  ) : (
    <Minus size={18} className="mx-auto text-slate-400" aria-label="Not allowed" />
  );
}

function InviteDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: MemberRecord[] }) {
  const user = useSessionUser();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Sales rep");
  const [errors, setErrors] = useState<Errors<"name" | "email">>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const errs: Errors<"name" | "email"> = {};
    if (!name.trim()) errs.name = "Enter their name.";
    if (!email.trim()) errs.email = "Enter their work email.";
    else if (!isEmail(email)) errs.email = "Enter a valid email, like name@company.com.";
    else if (existing.some((m) => m.email === email.trim().toLowerCase())) errs.email = "This person is already on the team.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    inviteMember({ name, email, role }, user);
    toast(`Invite sent to ${email.trim().toLowerCase()}`);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Invite a team member"
      description="They get an email with a link to set their password. Until then they show as Pending."
      icon={
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-[#0F2318] text-primary">
          <UserPlus size={20} />
        </span>
      }
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="invite-form" className={btnPrimary}>
            Send invite
          </button>
        </div>
      }
    >
      <form id="invite-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Kamran Shah" />
        <TextField label="Work email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} placeholder="name@company.com" />
        <SelectField
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          options={ROLES.map((r) => ({ value: r, label: `${r} · ${roleNote[r]}` }))}
        />
      </form>
    </Modal>
  );
}

export default function TeamView({ permissions }: { permissions: PermissionRow[] }) {
  const crm = useCrm();
  const user = useSessionUser();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteKey, setInviteKey] = useState(0);
  const [revoke, setRevoke] = useState<MemberRecord | null>(null);

  if (!crm || !user) return null;
  const members = crm.members;
  const admins = members.filter((m) => m.role === "Admin" && m.status === "Active").length;

  function onRoleChange(m: MemberRecord, role: Role) {
    if (!user) return;
    if (m.role === "Admin" && role !== "Admin" && admins <= 1) {
      toast("Nexora needs at least one admin. Make someone else an admin first.", { tone: "error" });
      return;
    }
    changeMemberRole(m.id, role, user);
    // Demo accounts: apply the new role to their logins too.
    if (m.userId) setRoleOverride(m.userId, role);
    toast(`${m.name} is now ${role === "Admin" ? "an" : "a"} ${role}`);
  }

  const leadCount = (short: string) => crm.leads.filter((l) => l.owner === short && l.status !== "Converted").length;

  return (
    <>
      <PageHeader title="Team and roles" subtitle="Manage who can see and do what in Nexora.">
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setInviteKey((k) => k + 1);
            setInviteOpen(true);
          }}
        >
          + Invite member
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ROLES.map((role) => {
          const active = members.filter((m) => m.role === role && m.status === "Active").length;
          const pending = members.filter((m) => m.role === role && m.status === "Pending").length;
          return (
            <div key={role} className={`${card} flex flex-col gap-2 px-5 py-[18px]`}>
              <div className="text-[13px] text-slate-500">{role}</div>
              <div className="text-3xl font-extrabold tracking-tight">{active}</div>
              <div className="text-xs text-slate-500">
                {roleNote[role]}
                {pending > 0 && `. ${pending} invite${pending === 1 ? "" : "s"} pending`}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`${card} px-4 py-5 sm:px-6`}>
        <h2 className="mb-3 text-base font-bold">Members</h2>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <div className="min-w-[940px]">
            <div className={`${MEMBER_GRID} border-b border-line py-2 text-xs text-slate-500`}>
              <span>Member</span>
              <span>Email</span>
              <span>Role</span>
              <span>Leads</span>
              <span>Last active</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            {members.map((m) => {
              const isMe = m.userId === user.id;
              return (
                <div key={m.id} className={`${MEMBER_GRID} border-b border-[#18201B] py-3 text-[13.5px]`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={m.initials} size={34} />
                    <span className="truncate font-bold">
                      {m.name}
                      {isMe && <span className="ml-1.5 text-xs font-semibold text-slate-500">(you)</span>}
                    </span>
                  </div>
                  <span className="truncate text-slate-600">{m.email}</span>
                  <span>
                    {isMe ? (
                      <Badge tone={roleTone[m.role]}>{m.role}</Badge>
                    ) : (
                      <select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => onRoleChange(m, e.target.value as Role)} className={selectCls}>
                        {ROLES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </span>
                  <span>{m.status === "Active" ? leadCount(m.short) : "–"}</span>
                  <span className="text-slate-500">{m.status === "Pending" ? `Invited ${m.invitedAt ? timeAgo(m.invitedAt).toLowerCase() : ""}` : m.lastActiveAt ? (isMe ? "Just now" : timeAgo(m.lastActiveAt)) : "–"}</span>
                  <span>
                    <Badge tone={statusTone[m.status]}>{m.status}</Badge>
                  </span>
                  <span className="flex justify-end gap-3">
                    {m.status === "Pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            resendInvite(m.id, user);
                            toast(`Invite sent again to ${m.email}`);
                          }}
                          className="text-[13px] font-bold text-primary hover:underline"
                        >
                          Resend
                        </button>
                        <button type="button" onClick={() => setRevoke(m)} className="text-[13px] font-bold text-[#FF8F84] hover:underline">
                          Cancel
                        </button>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="flex flex-col gap-2.5 md:hidden">
          {members.map((m) => {
            const isMe = m.userId === user.id;
            return (
              <div key={m.id} className="flex flex-col gap-3 rounded-2xl border border-line p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar initials={m.initials} size={38} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">
                      {m.name}
                      {isMe ? " (you)" : ""}
                    </b>
                    <span className="block truncate text-xs text-slate-500">{m.email}</span>
                  </span>
                  <Badge tone={statusTone[m.status]}>{m.status}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {isMe ? (
                    <Badge tone={roleTone[m.role]}>{m.role}</Badge>
                  ) : (
                    <select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => onRoleChange(m, e.target.value as Role)} className={selectCls}>
                      {ROLES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  )}
                  {m.status === "Pending" && (
                    <span className="ml-auto flex gap-3">
                      <button type="button" onClick={() => { resendInvite(m.id, user); toast(`Invite sent again to ${m.email}`); }} className="flex items-center gap-1 text-[13px] font-bold text-primary">
                        <Mail size={14} /> Resend
                      </button>
                      <button type="button" onClick={() => setRevoke(m)} className="text-[13px] font-bold text-[#FF8F84]">
                        Cancel
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Role changes apply straight away and are recorded in the audit log. You can’t change your own role.</p>
      </div>

      <div className={`${card} px-4 py-5 sm:px-6`}>
        <h2 className="mb-3 text-base font-bold">Role permissions</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className={`${PERM_GRID} border-b border-line py-2 text-center text-xs text-slate-500`}>
              <span className="text-left">Permission</span>
              <span>Admin</span>
              <span>Manager</span>
              <span>Sales rep</span>
            </div>
            {permissions.map((p) => (
              <div key={p.label} className={`${PERM_GRID} border-b border-[#18201B] py-3 text-[13.5px]`}>
                <span>{p.label}</span>
                <Tick on={p.admin} />
                <Tick on={p.manager} />
                <Tick on={p.rep} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {inviteOpen && <InviteDialog key={inviteKey} open onClose={() => setInviteOpen(false)} existing={members} />}
      <ConfirmDialog
        open={revoke !== null}
        onClose={() => setRevoke(null)}
        title="Cancel this invite?"
        body={<>{revoke?.email} won’t be able to use their invite link.</>}
        confirmLabel="Cancel invite"
        onConfirm={() => {
          if (revoke) {
            revokeInvite(revoke.id, user);
            toast(`Invite for ${revoke.email} cancelled`);
          }
        }}
      />
    </>
  );
}
