"use client";

import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleCheck,
  FileText,
  Mail,
  Phone,
  Plus,
  StickyNote,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ActivityKind, ActivityRecord } from "@/types";
import { formatDate, formatTime, timeAgo } from "@/lib/utils";

const kindStyle: Record<ActivityKind, { icon: LucideIcon; cls: string }> = {
  proposal: { icon: FileText, cls: "bg-[#E8EDFD] text-[#26357F]" },
  email: { icon: Mail, cls: "bg-[#FEF0CF] text-[#6B4200]" },
  call: { icon: Phone, cls: "bg-[#DDF3E7] text-[#128A52]" },
  meeting: { icon: CalendarDays, cls: "bg-[#F3E8FF] text-[#6B21A8]" },
  status: { icon: ArrowRight, cls: "bg-[#EEF1FA] text-slate-600" },
  created: { icon: Plus, cls: "bg-[#EEF1FA] text-slate-600" },
  note: { icon: StickyNote, cls: "bg-[#E6EAFE] text-[#26357F]" },
  assigned: { icon: UserRound, cls: "bg-[#EEF1FA] text-slate-600" },
  converted: { icon: CircleCheck, cls: "bg-[#EAF8EE] text-[#14663D]" },
  deal: { icon: BriefcaseBusiness, cls: "bg-[#E8EDFD] text-[#26357F]" },
};

const tabs = [
  { key: "all", label: "All activity", kinds: null },
  { key: "call", label: "Calls", kinds: ["call"] },
  { key: "email", label: "Emails", kinds: ["email"] },
  { key: "meeting", label: "Meetings", kinds: ["meeting"] },
  { key: "note", label: "Notes", kinds: ["note"] },
] as const;
type TabKey = (typeof tabs)[number]["key"];

/** Communication history with filters and a note composer. */
export default function ActivityFeed({
  title = "Communication history",
  activities,
  onAddNote,
  placeholder,
}: {
  title?: string;
  activities: ActivityRecord[];
  onAddNote?: (text: string) => void;
  placeholder?: string;
}) {
  const [tab, setTab] = useState<TabKey>("all");
  const [note, setNote] = useState("");
  const kinds = tabs.find((t) => t.key === tab)?.kinds;
  const visible = kinds ? activities.filter((a) => (kinds as readonly string[]).includes(a.kind)) : activities;

  function save() {
    const text = note.trim();
    if (!text || !onAddNote) return;
    onAddNote(text);
    setNote("");
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold">{title}</h2>
        <div role="tablist" className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`h-8 rounded-full px-3 text-[12.5px] font-bold ${tab === t.key ? "bg-navy text-white" : "bg-[#EEF1FA] text-slate-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {onAddNote && (
        <div className="flex flex-col gap-2">
          <label htmlFor="note" className="sr-only">
            Add a note
          </label>
          <textarea
            id="note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
            }}
            placeholder={placeholder ?? "Add a note. Mention a teammate with @"}
            className="w-full resize-y rounded-xl border-[1.5px] border-line bg-white p-3.5 text-sm outline-none placeholder:text-slate-500 focus:border-accent focus:ring-[3px] focus:ring-accent/20"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">Ctrl + Enter to save</span>
            <button
              type="button"
              onClick={save}
              disabled={!note.trim()}
              className="ml-auto h-9 rounded-xl bg-primary px-4 text-[13px] font-bold text-white shadow-[0_6px_14px_rgba(53,109,243,0.25)] hover:bg-[#2D5FDB] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save note
            </button>
          </div>
        </div>
      )}

      <ol className="flex flex-col">
        {visible.length === 0 && <li className="border-t border-[#EEF1F8] py-8 text-center text-sm text-slate-500">Nothing here yet.</li>}
        {visible.map((e) => {
          const { icon: Icon, cls } = kindStyle[e.kind] ?? kindStyle.note;
          return (
            <li key={e.id} className="flex items-start gap-3.5 border-t border-[#EEF1F8] py-3.5">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${cls}`}>
                <Icon size={16} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold">{e.title}</div>
                <div className="mt-0.5 break-words text-xs text-slate-500">{e.meta}</div>
              </div>
              <time dateTime={e.at} title={`${formatDate(e.at)}, ${formatTime(e.at)}`} className="shrink-0 text-[12.5px] text-slate-500">
                {timeAgo(e.at)}
              </time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
