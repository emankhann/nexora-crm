"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Download } from "lucide-react";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/layout/PageHeader";
import CustomerForm from "@/components/customers/CustomerForm";
import { EmptyState } from "@/components/ui/States";
import { openDealsFor, useCrm } from "@/lib/crm-store";
import { downloadCsv } from "@/lib/csv";
import { can, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary, card, searchCls, selectCls } from "@/lib/ui";
import { daysBetween, formatCurrency, formatDate } from "@/lib/utils";

const healthTone = { Healthy: "ok", Watch: "warm", "At risk": "hot" } as const;
const GRID = "grid grid-cols-[2fr_1.6fr_1.5fr_1.2fr_0.9fr_1fr_1fr_1.3fr] items-center gap-3 px-5";

function sinceLabel(since: string) {
  return Number.isNaN(Date.parse(since)) ? since : formatDate(new Date(since).toISOString());
}

export default function CustomersTable() {
  const crm = useCrm();
  const user = useSessionUser();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("All");
  const [health, setHealth] = useState("Any");
  const [owner, setOwner] = useState("Anyone");
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const customers = useMemo(() => (crm && user ? crm.customers.filter((c) => canSee(user, c.owner)) : []), [crm, user]);
  const industries = useMemo(() => Array.from(new Set(customers.map((c) => c.industry))).sort(), [customers]);
  const owners = useMemo(() => Array.from(new Set(customers.map((c) => c.owner))), [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter(
      (c) =>
        (!q || [c.name, ...c.contacts.map((p) => p.name)].some((v) => v.toLowerCase().includes(q))) &&
        (industry === "All" || c.industry === industry) &&
        (health === "Any" || c.health === health) &&
        (owner === "Anyone" || c.owner === owner)
    );
  }, [customers, query, industry, health, owner]);

  if (!crm || !user) return null;

  const isNew = (since: string) => !Number.isNaN(Date.parse(since)) && daysBetween(new Date(since).toISOString()) <= 30;
  const stats = [
    { label: "Total customers", value: String(customers.length), note: `${customers.filter((c) => isNew(c.since)).length} new in the last 30 days`, danger: false },
    { label: "Lifetime value", value: formatCurrency(customers.reduce((s, c) => s + c.lifetimeValue, 0)), note: "Across all customer accounts", danger: false },
    { label: "Accounts at risk", value: String(customers.filter((c) => c.health === "At risk").length), note: "No contact in 30+ days or a stalled renewal", danger: true },
  ];

  return (
    <>
      <PageHeader title="Customers" subtitle="Companies you have won, with their contacts, deals and health.">
        {can(user, "export") && (
          <button
            type="button"
            className={btnOutline}
            onClick={() =>
              downloadCsv(
                "nexora-customers.csv",
                ["Company", "Primary contact", "Email", "Industry", "Lifetime value", "Open deals", "Health", "Owner", "Customer since"],
                filtered.map((c) => [c.name, c.contacts[0]?.name ?? "", c.contacts[0]?.email ?? "", c.industry, c.lifetimeValue, openDealsFor(crm, c), c.health, c.owner, sinceLabel(c.since)])
              )
            }
          >
            <Download size={16} /> Export
          </button>
        )}
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setFormKey((k) => k + 1);
            setFormOpen(true);
          }}
        >
          + New customer
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`${card} flex flex-col gap-2 px-5 py-[18px]`}>
            <div className="text-[13px] text-slate-500">{s.label}</div>
            <div className={`text-3xl font-extrabold tracking-tight ${s.danger ? "text-hot" : ""}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.note}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <input
            type="search"
            aria-label="Filter customers"
            placeholder="Filter by company or contact"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${searchCls} basis-full sm:basis-auto`}
          />
          <label className="flex items-center gap-2 text-[13px] text-slate-500">
            Industry
            <select className={selectCls} value={industry} onChange={(e) => setIndustry(e.target.value)}>
              {["All", ...industries].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[13px] text-slate-500">
            Health
            <select className={selectCls} value={health} onChange={(e) => setHealth(e.target.value)}>
              {["Any", "Healthy", "Watch", "At risk"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          {can(user, "viewAll") && (
            <label className="flex items-center gap-2 text-[13px] text-slate-500">
              Owner
              <select className={selectCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
                {["Anyone", ...owners].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="border-t border-line">
            <EmptyState
              icon={
                <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-primary-soft text-primary">
                  <Building2 size={28} />
                </span>
              }
              title={customers.length === 0 ? "No customers yet" : "No customers match your filters"}
              body={customers.length === 0 ? "Convert a qualified lead, or add a customer who came in another way." : undefined}
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto border-t border-line md:block">
              <div className="min-w-[1020px]">
                <div className={`${GRID} py-3.5 text-xs text-slate-500`}>
                  <span>Company</span>
                  <span>Primary contact</span>
                  <span>Industry</span>
                  <span className="text-right">Lifetime value</span>
                  <span className="text-center">Open deals</span>
                  <span>Health</span>
                  <span>Owner</span>
                  <span>Customer since</span>
                </div>
                {filtered.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/customers/${c.id}`)}
                    className={`${GRID} cursor-pointer border-t border-row-line bg-surface py-3 text-[13.5px] hover:bg-hover`}
                  >
                    <Link href={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-avatar text-avatar-text ring-1 ring-ok-border text-xs font-bold">{c.initials}</div>
                      <span className="truncate font-bold hover:text-primary">{c.name}</span>
                    </Link>
                    <span className="truncate">{c.contacts[0]?.name ?? "–"}</span>
                    <span className="text-slate-600">{c.industry}</span>
                    <span className="text-right font-bold">{formatCurrency(c.lifetimeValue)}</span>
                    <span className="text-center font-semibold">{openDealsFor(crm, c)}</span>
                    <span>
                      <Badge tone={healthTone[c.health]}>{c.health}</Badge>
                    </span>
                    <span className="text-slate-600">{c.owner}</span>
                    <span className="text-slate-500">{sinceLabel(c.since)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2.5 border-t border-line bg-canvas p-3 md:hidden">
              {filtered.map((c) => (
                <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-avatar text-avatar-text ring-1 ring-ok-border text-xs font-bold">{c.initials}</div>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{c.name}</b>
                    <span className="text-[12.5px] text-slate-500">
                      {formatCurrency(c.lifetimeValue)} · {openDealsFor(crm, c)} open deals
                    </span>
                  </span>
                  <Badge tone={healthTone[c.health]}>{c.health}</Badge>
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="border-t border-row-line px-5 py-4 text-[13px] text-slate-500">
          Showing {filtered.length} of {customers.length} customers
        </div>
      </div>

      {formOpen && <CustomerForm key={formKey} open onClose={() => setFormOpen(false)} />}
    </>
  );
}
