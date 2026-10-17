import type { ReactNode } from "react";

export type Tone = "hot" | "warm" | "cold" | "ok" | "neutral";

type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

const toneClasses: Record<Tone, string> = {
  hot: "border-hot-border bg-hot-bg text-hot",
  warm: "border-warm-border bg-warm-bg text-warm",
  cold: "border-cold-border bg-cold-bg text-cold",
  ok: "border-ok-border bg-ok-bg text-ok",
  neutral: "border-edge bg-muted text-slate-600",
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
