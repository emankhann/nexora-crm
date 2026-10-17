import type { ReactNode } from "react";

export type Tone = "hot" | "warm" | "cold" | "ok" | "neutral";

type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

const toneClasses: Record<Tone, string> = {
  hot: "border-[#4A1F1C] bg-[#2A1312] text-[#FF8F84]",
  warm: "border-[#4A3A15] bg-[#261E0C] text-[#F6C866]",
  cold: "border-[#1E3346] bg-[#0F1C27] text-[#86C5F2]",
  ok: "border-[#1D4A31] bg-[#0F2318] text-[#5EEB9C]",
  neutral: "border-[#26302A] bg-[#171C19] text-slate-600",
};

export default function Badge({ children, tone = "ok", className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none",
        toneClasses[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
