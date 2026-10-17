"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import Badge from "@/components/ui/Badge";
import PageHeader from "@/components/layout/PageHeader";
import DealForm, { LostReasonDialog } from "@/components/pipeline/DealForm";
import { useToast } from "@/components/ui/Toast";
import { DEAL_STAGES, OPEN_STAGES, moveDeal, useCrm } from "@/lib/crm-store";
import { can, canEdit, canSee } from "@/lib/permissions";
import { useSessionUser } from "@/lib/session";
import { btnPrimary, card, selectCls } from "@/lib/ui";
import { initialsForOwner, ownerOptions } from "@/lib/users";
import { daysBetween, formatCurrency, formatDate } from "@/lib/utils";
import type { DealRecord, DealStage } from "@/types";

const tagTone = { Hot: "hot", Warm: "warm", New: "cold", Cold: "cold" } as const;
const columnBg: Record<DealStage, string> = {
  New: "bg-subtle",
  Contacted: "bg-subtle",
  Qualified: "bg-subtle",
  Proposal: "bg-subtle",
  Won: "bg-primary-soft",
  Lost: "bg-subtle",
};

function MoveMenu({ deal, onMove, onEdit }: { deal: DealRecord; onMove: (s: DealStage) => void; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Actions for ${deal.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-slate-600 hover:bg-line lg:h-7 lg:w-7"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" onClick={(e) => e.stopPropagation()} className="absolute right-0 top-9 z-20 w-[200px] rounded-[14px] border border-line bg-surface p-1.5 shadow-[0_18px_40px_rgba(2,8,23,0.22)]">
          <div className="px-2.5 pb-1.5 pt-2 text-[11px] font-extrabold tracking-[0.06em] text-slate-500">MOVE TO</div>
          {OPEN_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              disabled={s === deal.stage}
              onClick={() => {
                setOpen(false);
                onMove(s);
              }}
              className={`block w-full rounded-[9px] px-2.5 py-2 text-left text-[13px] font-semibold ${s === deal.stage ? "bg-primary-soft text-primary" : "hover:bg-slate-50"}`}
            >
              {s}
              {s === deal.stage ? " · current" : ""}
            </button>
          ))}
          {deal.stage !== "Won" && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onMove("Won"); }} className="block w-full rounded-[9px] px-2.5 py-2 text-left text-[13px] font-semibold text-ok hover:bg-slate-50">
              Mark as won
            </button>
          )}
          {deal.stage !== "Lost" && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onMove("Lost"); }} className="block w-full rounded-[9px] px-2.5 py-2 text-left text-[13px] font-semibold text-hot hover:bg-slate-50">
              Mark as lost…
            </button>
          )}
          <div className="my-1 h-px bg-row-line" />
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(); }} className="block w-full rounded-[9px] px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-slate-50">
            Open deal
          </button>
        </div>
      )}
    </div>
  );
}

export default function PipelineBoard() {
  const crm = useCrm();
  const user = useSessionUser();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [owner, setOwner] = useState("Anyone");
  const [closing, setClosing] = useState("any");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);
  const [openDealId, setOpenDealId] = useState<string | null>(() => params.get("deal"));
  const [creating, setCreating] = useState(false);
  const [lostDeal, setLostDeal] = useState<DealRecord | null>(null);
  const [k, setK] = useState(0);

  // Opening /pipeline?deal=… (from search or a reminder) while already here.
  const paramDeal = params.get("deal");
  const [lastParam, setLastParam] = useState(paramDeal);
  if (paramDeal !== lastParam) {
    setLastParam(paramDeal);
    if (paramDeal) {
      setOpenDealId(paramDeal);
      setK((x) => x + 1);
    }
  }

  const deals = useMemo(() => {
    if (!crm || !user) return [];
    const now = new Date();
    return crm.deals.filter((d) => {
      if (!canSee(user, d.owner)) return false;
      if (owner !== "Anyone" && d.owner !== owner) return false;
      const open = OPEN_STAGES.includes(d.stage);
      if (closing === "month") {
        const c = new Date(d.closeDate);
        return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear();
      }
      if (closing === "overdue") return open && daysBetween(d.closeDate) > 0;
      // Closed deals only show for 30 days so the board stays focused.
      if (!open) return d.closedAt ? daysBetween(d.closedAt) <= 30 : true;
      return true;
    });
  }, [crm, user, owner, closing]);

  if (!crm || !user) return null;

  const openDeals = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const openValue = openDeals.reduce((s, d) => s + d.value, 0);
  const weighted = openDeals.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const wonThisMonth = deals.filter((d) => d.stage === "Won" && d.closedAt && new Date(d.closedAt) >= monthStart).reduce((s, d) => s + d.value, 0);
  const overdue = openDeals.filter((d) => daysBetween(d.closeDate) > 0).length;
  const openDeal = openDealId ? crm.deals.find((d) => d.id === openDealId) : null;

  function move(deal: DealRecord, stage: DealStage) {
    if (!user || deal.stage === stage) return;
    if (!canEdit(user, deal.owner)) {
      toast("You can only move your own deals.", { tone: "error" });
      return;
    }
    if (stage === "Lost") {
      setK((x) => x + 1);
      setLostDeal(deal);
      return;
    }
    const from = deal.stage;
    moveDeal(deal.id, stage, user);
    toast(stage === "Won" ? `${deal.title} won · ${formatCurrency(deal.value)}` : `${deal.title} moved to ${stage}`, {
      action: from !== "Lost" ? { label: "Undo", onClick: () => moveDeal(deal.id, from, user) } : undefined,
    });
  }

  function onDrop(e: DragEvent, stage: DealStage) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setOverStage(null);
    const deal = crm?.deals.find((d) => d.id === id);
    if (deal) move(deal, stage);
  }

  function openDetail(id: string) {
    setK((x) => x + 1);
    setOpenDealId(id);
  }

  function closeDetail() {
    setOpenDealId(null);
    if (params.get("deal")) router.replace("/pipeline");
  }

  return (
    <>
      <PageHeader title="Deals pipeline" subtitle={`${openDeals.length} open deals worth ${formatCurrency(openValue)}. Drag a card, or use its menu, to move it.`}>
        {can(user, "viewAll") && (
          <label className="flex items-center gap-2 text-[13px] text-slate-500">
            Owner
            <select className={selectCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
              {["Anyone", ...ownerOptions.filter((o) => o !== "Unassigned")].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-[13px] text-slate-500">
          Closing
          <select className={selectCls} value={closing} onChange={(e) => setClosing(e.target.value)}>
            <option value="any">Any time</option>
            <option value="month">This month</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
        <button
          type="button"
          className={btnPrimary}
          onClick={() => {
            setK((x) => x + 1);
            setCreating(true);
          }}
        >
          + New deal
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          { label: "Open pipeline", value: formatCurrency(openValue), cls: "" },
          { label: "Weighted forecast", value: formatCurrency(Math.round(weighted)), cls: "" },
          { label: "Won this month", value: formatCurrency(wonThisMonth), cls: "text-ok" },
          { label: "Overdue to close", value: `${overdue} ${overdue === 1 ? "deal" : "deals"}`, cls: overdue ? "text-hot" : "" },
        ].map((s) => (
          <div key={s.label} className={`${card} flex flex-col gap-1 px-[18px] py-4`}>
            <span className="text-[12.5px] text-slate-500">{s.label}</span>
            <b className={`text-[22px] ${s.cls}`}>{s.value}</b>
          </div>
        ))}
      </div>

      {/* Phones and tablets: one swipeable column at a time (snaps into place). Desktop: all six columns. */}
      <div className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0 lg:snap-none">
        <div className="grid auto-cols-[minmax(260px,82vw)] grid-flow-col items-start gap-3.5 sm:auto-cols-[300px] lg:min-w-[1440px] lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-6">
          {DEAL_STAGES.map((stage) => {
            const column = deals.filter((d) => d.stage === stage).sort((a, b) => a.closeDate.localeCompare(b.closeDate));
            const total = column.reduce((s, d) => s + d.value, 0);
            const isOver = overStage === stage && dragId !== null;
            return (
              <section
                key={stage}
                aria-label={`${stage} column`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overStage !== stage) setOverStage(stage);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
                }}
                onDrop={(e) => onDrop(e, stage)}
                className={`flex min-h-[200px] snap-start flex-col gap-2.5 rounded-2xl p-3 transition-shadow ${columnBg[stage]} ${isOver ? "ring-2 ring-primary ring-offset-2 ring-offset-canvas" : ""}`}
              >
                <div className="flex flex-col gap-0.5 px-1 pt-0.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[14.5px] font-extrabold">{stage}</h2>
                    <span className="grid h-[22px] min-w-6 place-items-center rounded-full bg-surface px-[7px] text-[11.5px] font-extrabold">{column.length}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    {formatCurrency(total)}
                    {stage === "Won" || stage === "Lost" ? " · last 30 days" : ""}
                  </span>
                </div>

                {column.length === 0 && (
                  <div className="rounded-xl border border-dashed border-bar-hover py-6 text-center text-[13px] text-slate-500">{isOver ? "Drop here" : "No deals"}</div>
                )}

                {column.map((d) => {
                  const late = OPEN_STAGES.includes(d.stage) ? daysBetween(d.closeDate) : 0;
                  const movable = canEdit(user, d.owner);
                  return (
                    <article
                      key={d.id}
                      draggable={movable}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", d.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(d.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      onClick={() => openDetail(d.id)}
                      className={`relative flex cursor-pointer flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5 hover:border-edge-strong ${dragId === d.id ? "opacity-50" : ""} ${movable ? "active:cursor-grabbing" : ""}`}
                    >
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold">{d.title}</h3>
                          <div className="mt-0.5 truncate text-[12.5px] text-slate-500">{d.company}</div>
                        </div>
                        {movable && <MoveMenu deal={d} onMove={(s) => move(d, s)} onEdit={() => openDetail(d.id)} />}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[17px] font-extrabold tracking-tight">{formatCurrency(d.value)}</span>
                        <Badge tone={d.stage === "Won" ? "ok" : d.stage === "Lost" ? "neutral" : tagTone[d.tag]}>{d.stage === "Won" || d.stage === "Lost" ? d.stage : d.tag}</Badge>
                      </div>
                      {OPEN_STAGES.includes(d.stage) ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="h-[5px] rounded-full bg-subtle">
                            <div className="h-[5px] rounded-full bg-primary" style={{ width: `${d.probability}%` }} />
                          </div>
                          <div className="flex justify-between text-[11.5px] font-semibold">
                            <span className="text-slate-600">{d.probability}% likely</span>
                            <span className={late > 0 ? "text-hot" : "text-slate-600"}>{late > 0 ? `Overdue · ${formatDate(d.closeDate)}` : `Close ${formatDate(d.closeDate)}`}</span>
                          </div>
                        </div>
                      ) : (
                        <div className={`text-xs font-semibold ${d.stage === "Won" ? "text-ok" : "text-slate-600"}`}>
                          {d.stage} {formatDate(d.closedAt ?? d.closeDate)}
                          {d.stage === "Lost" && d.lostReason ? ` · ${d.lostReason}` : ""}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-avatar text-avatar-text ring-1 ring-ok-border text-[10px] font-extrabold">{initialsForOwner(d.owner)}</span>
                        <span className="truncate">{d.next || d.owner}</span>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      {creating && <DealForm key={`n${k}`} open onClose={() => setCreating(false)} />}
      {openDeal && <DealForm key={`d${k}-${openDeal.id}`} open onClose={closeDetail} deal={openDeal} />}
      {lostDeal && <LostReasonDialog key={`l${k}`} open onClose={() => setLostDeal(null)} deal={lostDeal} />}
    </>
  );
}
