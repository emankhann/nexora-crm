"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  CheckSquare,
  ChevronUp,
  FileText,
  Home,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCrm, resetDemoData } from "@/lib/crm-store";
import { can, canSee } from "@/lib/permissions";
import { clearRoleOverrides, signOut, useSessionUser } from "@/lib/session";

type NavItem = { label: string; href: string; icon: LucideIcon; count?: "leads" | "tasks" };

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Leads", href: "/leads", icon: BarChart3, count: "leads" },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Pipeline", href: "/pipeline", icon: BriefcaseBusiness },
  { label: "Tasks", href: "/tasks", icon: CheckSquare, count: "tasks" },
  { label: "Reports", href: "/reports", icon: FileText },
];

const adminItems: NavItem[] = [
  { label: "Team and roles", href: "/team", icon: ShieldCheck },
  { label: "Audit log", href: "/audit-log", icon: Activity },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar({ onNavigate, onClose }: { onNavigate?: () => void; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSessionUser();
  const crm = useCrm();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const counts = {
    leads: crm && user ? crm.leads.filter((l) => l.status !== "Converted" && canSee(user, l.owner)).length : undefined,
    tasks: crm && user ? crm.tasks.filter((t) => !t.done && canSee(user, t.owner)).length : undefined,
  };

  function handleSignOut() {
    signOut();
    router.replace("/login");
  }

  const link = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const Icon = item.icon;
    const count = item.count ? counts[item.count] : undefined;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-medium transition-colors ${
          active ? "bg-primary font-semibold text-ink shadow-[0_8px_24px_rgba(46,224,127,0.22)]" : "text-[#9AA69E] hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className="flex items-center gap-4">
          <Icon className="h-4 w-4" strokeWidth={2.3} />
          {item.label}
        </span>
        {count !== undefined && (
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white/10 px-2 text-[11px] font-bold text-current">{count}</span>
        )}
      </Link>
    );
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-ink text-navy">
      <div className="flex items-center gap-4 px-5 pb-7 pt-6">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-2xl font-bold leading-none text-ink shadow-[0_0_24px_rgba(46,224,127,0.45)]">
          N
        </div>
        <div className="flex-1 text-2xl font-extrabold tracking-tight text-white">Nexora</div>
        {onClose && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-4 pt-1">
        <div className="space-y-1.5">{navItems.map(link)}</div>
        {can(user, "manageTeam") && (
          <div className="mt-7 space-y-1.5 border-t border-white/10 pt-5">
            <div className="px-3 pb-1 text-[11px] font-bold tracking-[0.08em] text-slate-400">ADMIN</div>
            {adminItems.map(link)}
          </div>
        )}
      </nav>

      <div ref={menuRef} className="relative mt-auto shrink-0 border-t border-white/10 bg-white/5 px-4 py-4">
        {menuOpen && user && (
          <div role="menu" aria-label="Account" className="absolute inset-x-4 bottom-[88px] z-10 rounded-[14px] bg-surface p-1.5 text-navy shadow-[0_18px_40px_rgba(2,8,23,0.35)]">
            <div className="mb-1 border-b border-[#18201B] px-3 py-2.5">
              <div className="text-[13px] font-bold">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            {can(user, "manageTeam") && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  resetDemoData();
                  clearRoleOverrides();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13.5px] font-semibold hover:bg-slate-50"
              >
                <RotateCcw size={15} /> Reset demo data
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-[10px] bg-[#1F1111] px-3 py-2.5 text-left text-[13.5px] font-bold text-[#FF8F84] hover:bg-[#2A1312]"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-4 rounded-2xl border border-line bg-[#0E1210] px-3 py-3 text-left text-white hover:bg-[#151B17]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-ink">
            {user?.initials ?? ""}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-base font-semibold text-white">{user?.name ?? " "}</span>
            <span className="block text-xs text-slate-500">{user?.role ?? " "}</span>
          </span>
          <ChevronUp size={16} className={`transition-transform ${menuOpen ? "" : "rotate-180"}`} />
        </button>
      </div>
    </aside>
  );
}
