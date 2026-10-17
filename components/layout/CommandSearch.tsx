"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useCrm } from "@/lib/crm-store";
import { canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { formatCurrency, formatDue } from "@/lib/utils";

type Result = { id: string; group: string; title: string; sub: string; href: string; badge: string };

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-warm-bg px-px text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** Ctrl/⌘ K search across leads, customers, deals and tasks. */
export default function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const crm = useCrm();
  const user = useSessionUser();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const results = useMemo<Result[]>(() => {
    if (!crm || !user) return [];
    const term = q.trim().toLowerCase();
    const has = (...v: string[]) => !term || v.some((x) => x.toLowerCase().includes(term));
    const out: Result[] = [];
    crm.leads
      .filter((l) => canSee(user, l.owner) && has(l.name, l.company, l.email))
      .slice(0, 5)
      .forEach((l) => out.push({ id: `l${l.id}`, group: "Leads", title: l.name, sub: `${l.company} · score ${l.score}`, href: `/leads/${l.id}`, badge: "Lead" }));
    crm.customers
      .filter((c) => canSee(user, c.owner) && has(c.name, ...c.contacts.map((p) => p.name)))
      .slice(0, 4)
      .forEach((c) => out.push({ id: `c${c.id}`, group: "Customers", title: c.name, sub: `${c.industry} · ${c.contacts[0]?.name ?? ""}`, href: `/customers/${c.id}`, badge: "Customer" }));
    crm.deals
      .filter((d) => canSee(user, d.owner) && has(d.title, d.company))
      .slice(0, 4)
      .forEach((d) => out.push({ id: `d${d.id}`, group: "Deals", title: d.title, sub: `${d.company} · ${d.stage} · ${formatCurrency(d.value)}`, href: `/pipeline?deal=${d.id}`, badge: "Deal" }));
    crm.tasks
      .filter((t) => !t.done && canSee(user, t.owner) && has(t.title, t.contact, t.company))
      .slice(0, 4)
      .forEach((t) => out.push({ id: `t${t.id}`, group: "Tasks", title: t.title, sub: `Due ${formatDue(t.dueAt)} · ${t.owner}`, href: `/tasks?open=${t.id}`, badge: "Task" }));
    if (!term || "create a lead new lead".includes(term))
      out.push({ id: "new-lead", group: "Quick actions", title: "Create a lead", sub: "Opens the new lead form", href: "/leads?new=1", badge: "Action" });
    if (!term || "create a task new task".includes(term))
      out.push({ id: "new-task", group: "Quick actions", title: "Create a task", sub: "Opens the new task form", href: "/tasks?new=1", badge: "Action" });
    return out;
  }, [crm, user, q]);

  function close() {
    setQ("");
    setActive(0);
    onClose();
  }

  function go(r: Result | undefined) {
    if (!r) return;
    router.push(r.href);
    close();
  }

  let lastGroup = "";

  return (
    <dialog
      ref={ref}
      aria-label="Search"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
      className="mx-auto mb-auto mt-[12vh] w-[calc(100%-32px)] max-w-[640px] overflow-hidden rounded-[20px] bg-surface p-0 text-navy shadow-[0_30px_70px_rgba(2,8,23,0.35)] backdrop:bg-black/50"
    >
      {open && (
        <div>
          <div className="flex items-center gap-3 border-b border-row-line px-[18px] py-4">
            <Search size={20} className="text-slate-500" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  go(results[active]);
                }
              }}
              role="combobox"
              aria-expanded="true"
              aria-controls="search-results"
              aria-activedescendant={results[active] ? `sr-${results[active].id}` : undefined}
              placeholder="Search leads, customers, deals and tasks"
              className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold outline-none placeholder:font-normal placeholder:text-slate-500"
            />
            <kbd className="rounded-md bg-subtle px-[7px] py-[3px] text-[11px] font-bold text-slate-700">Esc</kbd>
          </div>
          <div id="search-results" role="listbox" className="max-h-[min(460px,60dvh)] overflow-y-auto px-2 pb-2 pt-1.5">
            {results.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">Nothing matches “{q}”.</div>}
            {results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null;
              lastGroup = r.group;
              return (
                <div key={r.id}>
                  {header && <div className="px-3.5 pb-1 pt-2.5 text-[11px] font-extrabold tracking-[0.07em] text-slate-500">{header.toUpperCase()}</div>}
                  <button
                    id={`sr-${r.id}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] ${
                      i === active ? "bg-primary-soft outline outline-2 -outline-offset-2 outline-primary" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">
                        <Highlight text={r.title} q={q.trim()} />
                      </b>
                      <span className="block truncate text-xs text-slate-500">{r.sub}</span>
                    </span>
                    <span className="rounded-full border border-edge bg-muted px-2 py-[3px] text-[11px] font-bold text-slate-600">{r.badge}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="hidden gap-4 border-t border-row-line bg-hover px-[18px] py-2.5 text-xs text-slate-500 sm:flex">
            <span>↑ ↓ to move</span>
            <span>Enter to open</span>
            <span>Esc to close</span>
          </div>
        </div>
      )}
    </dialog>
  );
}
