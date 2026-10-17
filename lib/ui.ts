/** Shared Tailwind class strings so every form and button matches the designs. */

export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-[18px] text-[13.5px] font-bold text-ink shadow-[0_0_0_1px_rgba(46,224,127,0.4),0_8px_24px_rgba(46,224,127,0.25)] hover:bg-[#5BEA9C] disabled:cursor-not-allowed disabled:bg-[#1F5C3B] disabled:text-[#87948B] disabled:shadow-none";

export const btnOutline =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#26302A] bg-surface px-4 text-[13.5px] font-semibold text-navy hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const btnDanger =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#C8322A] px-[18px] text-[13.5px] font-bold text-white shadow-[0_6px_14px_rgba(180,35,24,0.22)] hover:bg-[#A92A22] disabled:cursor-not-allowed disabled:opacity-60";

export const btnGhostDanger =
  "inline-flex h-10 items-center justify-center rounded-xl px-2 text-[13.5px] font-bold text-[#FF8F84] hover:bg-[#1F1111]";

export const iconBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#26302A] bg-surface text-slate-700 hover:bg-slate-50";

export const inputCls =
  "h-[42px] w-full rounded-xl border border-[#26302A] bg-surface px-3.5 text-sm font-medium text-navy outline-none placeholder:font-normal placeholder:text-slate-500 focus:border-accent focus:ring-[3px] focus:ring-accent/20 aria-[invalid=true]:border-[#F2554A] aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-[#F2554A]/15";

export const textareaCls = `${inputCls} h-auto resize-y py-2.5`;

export const selectCls = "h-[38px] rounded-[10px] border border-line bg-surface px-2.5 text-[13px]";

export const searchCls =
  "h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-[#171C19] px-3.5 text-[13.5px] outline-none placeholder:text-slate-500 focus:border-accent focus:bg-surface sm:min-w-[260px]";

export const card = "rounded-2xl border border-line bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

export const sectionLabel = "text-xs font-extrabold tracking-[0.06em] text-slate-500";

export function chipCls(active: boolean) {
  return `flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-semibold ${
    active ? "bg-primary text-ink" : "bg-[#1A201C] text-slate-700 hover:bg-[#222A25]"
  }`;
}

export function chipCountCls(active: boolean) {
  return `rounded-full px-[7px] py-0.5 text-[11px] font-bold ${active ? "bg-white/20" : "bg-[#26302A]"}`;
}
