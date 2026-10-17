"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import NotificationsBell from "@/components/layout/NotificationsBell";
import CommandSearch from "@/components/layout/CommandSearch";
import { ToastProvider } from "@/components/ui/Toast";
import { PageSkeleton } from "@/components/ui/States";
import { useCrm } from "@/lib/crm-store";
import { useSessionUser } from "@/lib/session";

/**
 * Calls onChange when the route changes. Kept in its own component so the
 * URL read sits inside <Suspense> and doesn't block the static shell.
 */
function RouteChangeListener({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const last = useRef(pathname);
  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    onChange();
  }, [pathname, onChange]);
  return null;
}

/** Black placeholder (matches the sidebar) while the sidebar (which reads the URL) streams in. */
const sidebarFallback = <div className="h-full w-full border-r border-line bg-ink" />;

/**
 * The signed-in frame: sidebar (drawer on mobile), top bar with search and
 * reminders, and toasts. Pages render inside <main>.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const user = useSessionUser();
  const crm = useCrm();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [closeNav] = useState(() => () => setNavOpen(false));

  // Ctrl/⌘ K opens search from anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lock page scroll behind the open mobile menu.
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  const ready = Boolean(user && crm);

  return (
    <ToastProvider>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <div className="sticky top-0 hidden h-dvh w-[260px] shrink-0 lg:block xl:w-[280px]">
          <Suspense fallback={sidebarFallback}>
            <Sidebar />
          </Suspense>
        </div>

        {/* Mobile drawer */}
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/55"
              onClick={() => setNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] shadow-[20px_0_50px_rgba(2,8,23,0.35)]">
              <Suspense fallback={sidebarFallback}>
                <Sidebar onNavigate={() => setNavOpen(false)} onClose={() => setNavOpen(false)} />
              </Suspense>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center gap-1 border-b border-line bg-ink px-1.5 py-2.5 lg:hidden">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-xl text-white hover:bg-white/10"
            >
              <Menu size={22} />
            </button>
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-primary text-[15px] font-extrabold text-ink">N</span>
            <b className="ml-1.5 flex-1 text-lg text-white">Nexora</b>
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-xl text-white hover:bg-white/10"
            >
              <Search size={20} />
            </button>
            <NotificationsBell dark />
          </header>

          {/* Desktop top bar */}
          <div className="hidden items-center justify-end gap-2.5 px-6 pt-5 lg:flex lg:px-8">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-10 w-[260px] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] text-slate-500 hover:border-edge-strong"
            >
              <Search size={15} aria-hidden />
              Search or jump to
              <kbd className="ml-auto rounded-md bg-subtle px-[7px] py-[3px] text-[11px] font-bold text-slate-700">Ctrl K</kbd>
            </button>
            <NotificationsBell />
          </div>

          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:px-8 lg:pb-8 lg:pt-4">
            {!ready && <PageSkeleton />}
            {/* Always render the page so it is part of the server render; keep it hidden until the browser data is ready. */}
            <div hidden={!ready} className="space-y-5">
              {children}
            </div>
          </main>
        </div>
      </div>
      <Suspense fallback={null}>
        <RouteChangeListener onChange={closeNav} />
      </Suspense>
      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </ToastProvider>
  );
}
