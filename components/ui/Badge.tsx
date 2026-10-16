import type { ReactNode } from "react";

export type Tone = "hot" | "warm" | "cold" | "ok" | "neutral";

type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

const toneClasses: Record<Tone, string> = {
  hot: "border-[#F7C9C3] bg-[#FDE4E4] text-[#8F1D14]",
  warm: "border-[#F2D98A] bg-[#FEF0CF] text-[#6B4200]",
  cold: "border-[#C3CFFB] bg-[#E6EAFE] text-[#26357F]",
  ok: "border-[#BDE6CC] bg-[#EAF8EE] text-[#14663D]",
  neutral: "border-[#D8DEEA] bg-[#F3F6FB] text-slate-600",
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
