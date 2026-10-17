"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Upload, UserPlus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/States";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import LeadForm from "@/components/leads/LeadForm";
import { AssignOwnerDialog, ChangeStatusDialog } from "@/components/leads/BulkDialogs";
import { deleteLeads, importLeads, useCrm } from "@/lib/crm-store";
import { downloadCsv, parseCsv } from "@/lib/csv";
import { can, canEdit, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary, chipCls, chipCountCls, searchCls, selectCls } from "@/lib/ui";
import { getOwnerOptions } from "@/lib/users";
import { formatDate, scoreTier, timeAgo } from "@/lib/utils";
import type { LeadRecord, LeadStatus } from "@/types";

export const statusTone: Record<LeadStatus, "ok" | "warm" | "cold" | "neutral"> = {
  Qualified: "ok",
  Contacted: "warm",
  New: "cold",
  Unqualified: "neutral",
  Converted: "ok",
};

type TabKey = "all" | "mine" | "hot" | "unassigned" | "converted";
const PAGE_SIZE = 10;
const GRID = "grid grid-cols-[36px_2.3fr_1.4fr_1fr_1.1fr_1.7fr_1fr_1.1fr] items-center gap-3 px-5";

function inTab(l: LeadRecord, tab: TabKey, me: string) {
  if (tab === "converted") return l.status === "Converted";
  if (l.status === "Converted") return false;
  if (tab === "mine") return l.owner === me;
  if (tab === "hot") return scoreTier(l.score).key === "hot";
  if (tab === "unassigned") return l.owner === "Unassigned";
  return true;
}

function ScoreBar({ score }: { score: number }) {
  const t = scoreTier(score);
  return (
    <span className="flex items-center gap-2.5">
      <b className="w-6">{score}</b>
      <span className="h-1.5 w-[84px] rounded-full bg-subtle">
        <span className={`block h-1.5 rounded-full ${t.bar}`} style={{ width: `${score}%` }} />
      </span>
      <span className={`text-xs font-bold ${t.text}`}>{t.label}</span>
    </span>
  );
}

export default function LeadsTable() {
  const crm = useCrm();
  const user = useSessionUser();
  const toast = useToast();
  const showError = useErrorToast();
  const [importing, setImporting] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const viewAll = can(user, "viewAll");
  // Only the tab the user clicked is stored. Until then (and if it isn't one this user
  // has), the default follows their role. The user is only known once the API data has
  // loaded, which is after this page first renders, so the default can't be fixed up front.
  const [chosenTab, setTab] = useState<TabKey | null>(null);
  const tab: TabKey =
    chosenTab && (viewAll || (chosenTab !== "all" && chosenTab !== "unassigned")) ? chosenTab : viewAll ? "all" : "mine";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [owner, setOwner] = useState("Anyone");
  const [tier, setTier] = useState("Any");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null | "new" | "assign" | "status" | "delete">(() => (params.get("new") === "1" ? "new" : null));
  const [dialogKey, setDialogKey] = useState(0);

  // "Create a lead" from search while already on this page.
  const paramNew = params.get("new");
  const [lastParam, setLastParam] = useState(paramNew);
  if (paramNew !== lastParam) {
    setLastParam(paramNew);
    if (paramNew === "1") {
      setDialog("new");
      setDialogKey((x) => x + 1);
    }
  }

  const me = user?.short ?? "";
  const visibleLeads = useMemo(() => (crm && user ? crm.leads.filter((l) => canSee(user, l.owner)) : []), [crm, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleLeads
      .filter(
        (l) =>
          inTab(l, tab, me) &&
          (!q || [l.name, l.company, l.email].some((v) => v.toLowerCase().includes(q))) &&
          (status === "All" || l.status === status) &&
          (owner === "Anyone" || l.owner === owner) &&
          (tier === "Any" || scoreTier(l.score).label === tier)
      )
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }, [visibleLeads, tab, me, query, status, owner, tier]);

  if (!crm || !user) return null;

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  const selectedLeads = crm.leads.filter((l) => selected.has(l.id));
  const allOnPage = pageRows.length > 0 && pageRows.every((l) => selected.has(l.id));
  const canBulkEdit = selectedLeads.every((l) => canEdit(user, l.owner));

  const tabs: { key: TabKey; label: string }[] = [
    ...(viewAll ? [{ key: "all" as const, label: "All leads" }] : []),
    { key: "mine", label: "My leads" },
    { key: "hot", label: "Hot leads" },
    ...(viewAll ? [{ key: "unassigned" as const, label: "Unassigned" }] : []),
    { key: "converted", label: "Converted" },
  ];

  function resetPage() {
    setPage(0);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((l) => (allOnPage ? next.delete(l.id) : next.add(l.id)));
      return next;
    });
  }

  function openDialog(d: typeof dialog) {
    setDialogKey((k) => k + 1);
    setDialog(d);
  }

  function closeDialog() {
    setDialog(null);
    if (params.get("new")) router.replace("/leads");
  }

  function exportCsv() {
    downloadCsv(
      `nexora-leads-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Email", "Phone", "Job title", "Company", "Source", "Status", "Score", "Owner", "Created"],
      filtered.map((l) => [l.name, l.email, l.phone, l.title, l.company, l.source, l.status, l.score, l.owner, formatDate(l.createdAt)])
    );
    toast(`Exported ${filtered.length} leads`);
  }

  async function importCsv(file: File) {
    if (!user || !crm || importing) return;
    // Quick checks here so obvious mistakes get a clear message; the server checks every row again.
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      toast("That file has no rows to import.", { tone: "error" });
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    if (!header.some((h) => h === "name" || h === "full name") || !header.includes("email")) {
      toast("The CSV needs at least Name and Email columns.", { tone: "error" });
      return;
    }
    setImporting(true);
    try {
      const { added, skipped } = await importLeads(file);
      toast(`Imported ${added} ${added === 1 ? "lead" : "leads"}${skipped ? ` · skipped ${skipped} (duplicate or missing email)` : ""}`, {
        tone: added ? "success" : "error",
      });
    } catch (err) {
      showError(err);
    } finally {
      setImporting(false);
    }
  }

  const hasFilters = query || status !== "All" || owner !== "Anyone" || tier !== "Any";

  return (
    <>
      <PageHeader
        title={viewAll ? "Leads" : "My leads"}
        subtitle={
          viewAll
            ? `${visibleLeads.filter((l) => l.status !== "Converted").length} open leads. Scores update automatically as leads engage.`
            : `${visibleLeads.filter((l) => l.status !== "Converted").length} leads assigned to you.`
        }
      />

      {!viewAll && (
        <div className="rounded-xl bg-subtle px-4 py-3 text-[13.5px] text-avatar-text">
          As a <b>Sales rep</b> you see only the leads assigned to you. To hand a lead to someone else, ask your manager.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    resetPage();
                  }}
                  className={chipCls(tab === t.key)}
                >
                  {t.label}
                  <span className={chipCountCls(tab === t.key)}>{visibleLeads.filter((l) => inTab(l, t.key, me)).length}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2.5">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importCsv(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className={btnOutline}
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                title="Columns: Name, Email, Company, Phone, Job title, Source"
              >
                <Upload size={16} />
                {importing ? "Importing…" : "Import CSV"}
              </button>
              {can(user, "export") && (
                <button type="button" className={btnOutline} onClick={exportCsv}>
                  <Download size={16} />
                  Export
                </button>
              )}
              <button type="button" className={btnPrimary} onClick={() => openDialog("new")}>
                + New lead
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              aria-label="Filter leads"
              placeholder="Filter by name, company or email"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetPage();
              }}
              className={`${searchCls} basis-full sm:basis-auto`}
            />
            <label className="flex items-center gap-2 text-[13px] text-slate-500">
              Status
              <select
                className={selectCls}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  resetPage();
                }}
              >
                {["All", "New", "Contacted", "Qualified", "Unqualified", "Converted"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            {viewAll && (
              <label className="flex items-center gap-2 text-[13px] text-slate-500">
                Owner
                <select
                  className={selectCls}
                  value={owner}
                  onChange={(e) => {
                    setOwner(e.target.value);
                    resetPage();
                  }}
                >
                  {["Anyone", ...getOwnerOptions()].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-[13px] text-slate-500">
              Score
              <select
                className={selectCls}
                value={tier}
                onChange={(e) => {
                  setTier(e.target.value);
                  resetPage();
                }}
              >
                {["Any", "Hot", "Warm", "Cold"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-subtle px-5 py-2.5">
            <span className="text-[13.5px] font-semibold text-avatar-text">
              {selected.size} {selected.size === 1 ? "lead" : "leads"} selected
              <button type="button" onClick={() => setSelected(new Set())} className="ml-3 font-bold text-primary hover:underline">
                Clear
              </button>
            </span>
            <div className="flex flex-wrap gap-2">
              {can(user, "reassign") && (
                <button type="button" onClick={() => openDialog("assign")} className="h-[34px] rounded-xl bg-surface px-4 text-[13px] font-semibold hover:bg-slate-50">
                  Assign owner
                </button>
              )}
              {canBulkEdit && (
                <button type="button" onClick={() => openDialog("status")} className="h-[34px] rounded-xl bg-surface px-4 text-[13px] font-semibold hover:bg-slate-50">
                  Change status
                </button>
              )}
              {can(user, "delete") && (
                <button type="button" onClick={() => openDialog("delete")} className="h-[34px] rounded-xl bg-surface px-4 text-[13px] font-semibold text-hot hover:bg-hot-soft">
                  Delete
                </button>
              )}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="border-t border-line">
            {visibleLeads.length === 0 ? (
              <EmptyState
                icon={
                  <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-primary-soft text-primary">
                    <UserPlus size={28} />
                  </span>
                }
                title="No leads yet"
                body="Add your first lead or import a CSV from your old spreadsheet."
                action={
                  <>
                    <button type="button" className={btnPrimary} onClick={() => openDialog("new")}>
                      + New lead
                    </button>
                    <button type="button" className={btnOutline} onClick={() => fileRef.current?.click()}>
                      Import CSV
                    </button>
                  </>
                }
              />
            ) : (
              <EmptyState
                title={hasFilters ? "No leads match your filters" : "Nothing in this tab"}
                action={
                  hasFilters ? (
                    <button
                      type="button"
                      className={btnOutline}
                      onClick={() => {
                        setQuery("");
                        setStatus("All");
                        setOwner("Anyone");
                        setTier("Any");
                      }}
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto border-t border-line md:block">
              <div className="min-w-[1020px]">
                <div className={`${GRID} py-3.5 text-xs text-slate-500`}>
                  <input type="checkbox" aria-label="Select all leads on this page" checked={allOnPage} onChange={toggleAll} className="h-[17px] w-[17px] accent-primary" />
                  <span>Lead</span>
                  <span>Company</span>
                  <span>Source</span>
                  <span>Status</span>
                  <span>Score</span>
                  <span>Owner</span>
                  <span>Last activity</span>
                </div>
                {pageRows.map((l) => {
                  const isSel = selected.has(l.id);
                  return (
                    <div key={l.id} className={`${GRID} border-t border-row-line py-3 text-[13.5px] ${isSel ? "bg-primary-soft" : "bg-surface hover:bg-hover"}`}>
                      <input type="checkbox" aria-label={`Select ${l.name}`} checked={isSel} onChange={() => toggle(l.id)} className="h-[17px] w-[17px] accent-primary" />
                      <Link href={`/leads/${l.id}`} className="flex min-w-0 items-center gap-3">
                        <Avatar initials={l.initials} />
                        <div className="min-w-0">
                          <div className="font-bold hover:text-primary">{l.name}</div>
                          <div className="truncate text-xs text-slate-500">{l.email}</div>
                        </div>
                      </Link>
                      <span className="truncate">{l.company}</span>
                      <span className="text-slate-600">{l.source}</span>
                      <span>
                        <Badge tone={statusTone[l.status]}>{l.status}</Badge>
                      </span>
                      <ScoreBar score={l.score} />
                      <span className="text-slate-600">{l.owner}</span>
                      <span className="text-slate-500">{timeAgo(l.lastActivityAt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-2.5 border-t border-line bg-canvas p-3 md:hidden">
              {pageRows.map((l) => {
                const t = scoreTier(l.score);
                return (
                  <Link key={l.id} href={`/leads/${l.id}`} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar initials={l.initials} size={38} />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[15px]">{l.name}</b>
                        <span className="text-[12.5px] text-slate-500">{l.company}</span>
                      </span>
                      <Badge tone={statusTone[l.status]}>{l.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2.5 text-[12.5px]">
                      <b>{l.score}</b>
                      <span className="h-1.5 flex-1 rounded-full bg-subtle">
                        <span className={`block h-1.5 rounded-full ${t.bar}`} style={{ width: `${l.score}%` }} />
                      </span>
                      <span className="text-slate-500">
                        {l.owner} · {timeAgo(l.lastActivityAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-row-line px-5 py-4 text-[13px] text-slate-500">
          <span>
            Showing {filtered.length === 0 ? 0 : current * PAGE_SIZE + 1}–{Math.min(filtered.length, (current + 1) * PAGE_SIZE)} of {filtered.length} leads
          </span>
          {pages > 1 && (
            <nav aria-label="Pages" className="flex max-w-full items-center gap-1.5 overflow-x-auto">
              <button type="button" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: pages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-current={i === current ? "page" : undefined}
                  onClick={() => setPage(i)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-[13px] font-bold ${i === current ? "bg-primary text-ink" : "border border-line bg-surface text-navy"}`}
                >
                  {i + 1}
                </button>
              ))}
              <button type="button" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </div>
      </div>

      {dialog === "new" && <LeadForm key={`new-${dialogKey}`} open onClose={closeDialog} />}
      {dialog === "assign" && (
        <AssignOwnerDialog key={`as-${dialogKey}`} open onClose={closeDialog} leads={selectedLeads} onDone={() => setSelected(new Set())} />
      )}
      {dialog === "status" && (
        <ChangeStatusDialog key={`st-${dialogKey}`} open onClose={closeDialog} leads={selectedLeads} onDone={() => setSelected(new Set())} />
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        onClose={closeDialog}
        title={`Delete ${selected.size} ${selected.size === 1 ? "lead" : "leads"}?`}
        body={
          <>
            {selectedLeads.map((l) => l.name).join(", ")} will be removed with their notes and open tasks. This can’t be undone. The deletion is
            recorded in the audit log.
          </>
        }
        confirmLabel={`Delete ${selected.size} ${selected.size === 1 ? "lead" : "leads"}`}
        onConfirm={async () => {
          await deleteLeads([...selected]);
          toast(`${selected.size} ${selected.size === 1 ? "lead" : "leads"} deleted`);
          setSelected(new Set());
        }}
      />
    </>
  );
}
