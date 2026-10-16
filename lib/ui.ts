/** Shared Tailwind class strings so every form and button matches the designs. */

export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-[18px] text-[13.5px] font-bold text-white shadow-[0_6px_14px_rgba(53,109,243,0.25)] hover:bg-[#2D5FDB] disabled:cursor-not-allowed disabled:bg-[#7EA2F7] disabled:shadow-none";

export const btnOutline =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D5DCEC] bg-white px-4 text-[13.5px] font-semibold text-navy hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export const btnDanger =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#B42318] px-[18px] text-[13.5px] font-bold text-white shadow-[0_6px_14px_rgba(180,35,24,0.22)] hover:bg-[#9A1F15] disabled:cursor-not-allowed disabled:opacity-60";

export const btnGhostDanger =
  "inline-flex h-10 items-center justify-center rounded-xl px-2 text-[13.5px] font-bold text-[#B42318] hover:bg-[#FEF3F2]";

export const iconBtn =
  "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#D5DCEC] bg-white text-slate-700 hover:bg-slate-50";

export const inputCls =
  "h-[42px] w-full rounded-xl border border-[#D5DCEC] bg-white px-3.5 text-sm font-medium text-navy outline-none placeholder:font-normal placeholder:text-slate-500 focus:border-accent focus:ring-[3px] focus:ring-accent/20 aria-[invalid=true]:border-[#D92D20] aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-[#D92D20]/15";

export const textareaCls = `${inputCls} h-auto resize-y py-2.5`;

export const selectCls = "h-[38px] rounded-[10px] border border-line bg-white px-2.5 text-[13px]";

export const searchCls =
  "h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-[#F0F3FB] px-3.5 text-[13.5px] outline-none placeholder:text-slate-500 focus:border-accent focus:bg-white sm:min-w-[260px]";

export const card = "rounded-2xl border border-line bg-white";

export const sectionLabel = "text-xs font-extrabold tracking-[0.06em] text-slate-500";

export function chipCls(active: boolean) {
  return `flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-semibold ${
    active ? "bg-navy text-white" : "bg-[#EEF1FA] text-slate-700 hover:bg-[#E3E8F6]"
  }`;
}

export function chipCountCls(active: boolean) {
  return `rounded-full px-[7px] py-0.5 text-[11px] font-bold ${active ? "bg-white/20" : "bg-[#DDE3F5]"}`;
}
