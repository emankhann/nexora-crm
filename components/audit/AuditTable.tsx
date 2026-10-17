"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/ui/Badge";
import type { AuditAction, AuditEvent } from "@/types";

const actionTone: Record<AuditAction, "ok" | "cold" | "warm" | "hot"> = {
  Converted: "ok",
  "Note added": "cold",
  Reassigned: "warm",
  "Status changed": "warm",
  "Call logged": "cold",
  "Role changed": "hot",
  Created: "ok",
  Updated: "cold",
  Deleted: "hot",
  "Deal moved": "warm",
  "Task created": "ok",
  "Task completed": "ok",
  "Signed in": "cold",
};

const GRID = "grid grid-cols-[1.2fr_1fr_1.1fr_1.6fr_2.6fr] items-center gap-3 px-5";
const selectCls = "h-[38px] rounded-[10px] border border-line bg-surface px-2.5 text-[13px]";

export default function AuditTable({ events }: { events: AuditEvent[] }) {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState("Anyone");
  const [action, setAction] = useState("Any");

  const users = useMemo(() => Array.from(new Set(events.map((event) => event.user))), [events]);
  const actions = useMemo(() => Array.from(new Set(events.map((event) => event.action))), [events]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return events.filter(
      (event) =>
        (!search || [event.record, event.details].some((value) => value.toLowerCase().includes(search))) &&
        (user === "Anyone" || event.user === user) &&
        (action === "Any" || event.action === action)
    );
  }, [events, query, user, action]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <input
          type="search"
          aria-label="Search the audit log"
          placeholder="Search by record or detail"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 min-w-0 flex-1 basis-full rounded-xl sm:min-w-[260px] sm:basis-auto border border-transparent bg-muted px-3.5 text-[13.5px] outline-none placeholder:text-slate-500 focus:border-accent focus:bg-surface"
        />
        <label className="flex items-center gap-2 text-[13px] text-slate-500">
          User
          <select className={selectCls} value={user} onChange={(event) => setUser(event.target.value)}>
            {["Anyone", ...users].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] text-slate-500">
          Action
          <select className={selectCls} value={action} onChange={(event) => setAction(event.target.value)}>
            {["Any", ...actions].map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>

      {/* Phones: one card per event */}
      <div className="flex flex-col gap-2.5 border-t border-line bg-canvas p-3 md:hidden">
        {filtered.length === 0 && <div className="py-10 text-center text-sm text-slate-500">No events match your filters.</div>}
        {filtered.map((event) => (
          <div key={event.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5 text-[13.5px]">
            <div className="flex items-center justify-between gap-3">
              <Badge tone={actionTone[event.action]}>{event.action}</Badge>
              <span className="text-xs text-slate-500">{event.when}</span>
            </div>
            <div>
              <b>{event.record}</b>
              <div className="mt-0.5 text-slate-600">{event.details}</div>
            </div>
            <div className="text-xs text-slate-500">By {event.user}</div>
          </div>
        ))}
      </div>

      {/* Tablet and desktop: table */}
      <div className="hidden overflow-x-auto border-t border-line md:block">
        <div className="min-w-[900px]">
          <div className={`${GRID} py-3.5 text-xs text-slate-500`}>
            <span>When</span><span>User</span><span>Action</span><span>Record</span><span>Details</span>
          </div>

          {filtered.length === 0 && (
            <div className="border-t border-row-line px-5 py-10 text-center text-sm text-slate-500">
              No events match your filters.
            </div>
          )}

          {filtered.map((event) => (
            <div key={event.id} className={`${GRID} border-t border-row-line bg-surface py-3 text-[13.5px]`}>
              <span className="text-slate-500">{event.when}</span>
              <span className="font-bold">{event.user}</span>
              <span><Badge tone={actionTone[event.action]}>{event.action}</Badge></span>
              <span>{event.record}</span>
              <span className="text-slate-600">{event.details}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-row-line px-5 py-4 text-[13px] text-slate-500">
        Showing {filtered.length} of {events.length} events
      </div>
    </div>
  );
}
