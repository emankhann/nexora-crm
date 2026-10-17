"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Clock, UserRound } from "lucide-react";
import { markNoticesRead, useCrm } from "@/lib/crm-store";
import { buildNotices, type Notice } from "@/lib/notifications";
import { useSessionUser } from "@/lib/session";

const kindStyle: Record<Notice["kind"], { cls: string; icon: typeof Bell }> = {
  overdue: { cls: "bg-[#2A1312] text-[#FF8F84]", icon: Clock },
  due: { cls: "bg-[#261E0C] text-[#F6C866]", icon: Clock },
  assigned: { cls: "bg-[#0F1C27] text-[#86C5F2]", icon: UserRound },
  deal: { cls: "bg-[#261E0C] text-[#F6C866]", icon: AlertTriangle },
};

export default function NotificationsBell({ dark = false }: { dark?: boolean }) {
  const crm = useCrm();
  const user = useSessionUser();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const ref = useRef<HTMLDivElement>(null);

  const notices = useMemo(() => (crm && user ? buildNotices(crm, user) : []), [crm, user]);
  const read = new Set(crm?.readNotices ?? []);
  const unread = notices.filter((n) => !read.has(n.id));
  const shown = tab === "unread" ? unread : notices;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          dark
            ? "relative grid h-11 w-11 place-items-center rounded-xl text-white hover:bg-white/10"
            : `relative grid h-10 w-10 place-items-center rounded-xl border bg-surface ${
                open ? "border-2 border-primary bg-[#0F2318] text-primary" : "border-[#26302A] text-slate-700 hover:bg-slate-50"
              }`
        }
      >
        <Bell size={18} strokeWidth={2.1} />
        {unread.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-canvas bg-[#F2554A] px-1 text-[10.5px] font-extrabold text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Reminders"
          className="fixed inset-x-3 top-[68px] z-50 flex max-h-[70dvh] flex-col rounded-[18px] border border-line bg-surface text-navy shadow-[0_24px_60px_rgba(2,8,23,0.22)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[400px]"
        >
          <div className="flex items-center justify-between px-[18px] pb-2.5 pt-4">
            <b className="text-base">Reminders</b>
            <button
              type="button"
              disabled={unread.length === 0}
              onClick={() => markNoticesRead(unread.map((n) => n.id))}
              className="text-[13px] font-bold text-primary disabled:text-slate-400"
            >
              Mark all as read
            </button>
          </div>
          <div className="flex gap-1.5 px-[18px] pb-2.5">
            {(["unread", "all"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`h-[30px] rounded-full px-3 text-[12.5px] font-bold ${tab === t ? "bg-primary text-ink" : "bg-[#1A201C]"}`}
              >
                {t === "unread" ? `Unread · ${unread.length}` : "All"}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
            {shown.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                {tab === "unread" ? "You’re all caught up." : "No reminders right now."}
              </div>
            )}
            {shown.map((n) => {
              const { cls, icon: Icon } = kindStyle[n.kind];
              const isUnread = !read.has(n.id);
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => {
                    markNoticesRead([n.id]);
                    setOpen(false);
                  }}
                  className={`flex gap-3 rounded-xl px-3.5 py-3 hover:bg-slate-50 ${isUnread ? "bg-[#0F1F16]" : ""}`}
                >
                  <span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] ${cls}`}>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13.5px] ${isUnread ? "font-bold" : "font-semibold"}`}>{n.title}</span>
                    <span className="text-xs text-slate-500">{n.meta}</span>
                  </span>
                  {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </div>
          <Link
            href="/tasks"
            onClick={() => setOpen(false)}
            className="border-t border-[#18201B] p-3 text-center text-[13px] font-bold text-primary"
          >
            Open all tasks
          </Link>
        </div>
      )}
    </div>
  );
}
