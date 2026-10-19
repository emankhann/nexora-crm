import type { ReactNode } from "react";
import { Activity, ChartColumn, ShieldCheck } from "lucide-react";
import Logo from "@/components/ui/Logo";

const features = [
  { icon: Activity, title: "Explainable lead scoring", text: "See exactly why each lead is hot, warm or cold." },
  { icon: ShieldCheck, title: "Role-based access", text: "Admins, managers and sales reps each see what they should." },
  { icon: ChartColumn, title: "A full audit trail", text: "Every change is recorded, so nothing gets lost." },
];

/** Navy brand panel on the left, form on the right. Stacks on mobile. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between gap-12 border-r border-line bg-ink px-16 py-[52px] text-white lg:flex">
        <Logo size={48} />
        <div className="flex max-w-[540px] flex-col gap-7">
          <h1 className="text-[52px] font-extrabold leading-[1.08] tracking-tight">
            Every lead. Every deal.
            <br />
            One place.
          </h1>
          <p className="text-[17px] leading-relaxed text-slate-600">
            Nexora helps your sales team capture leads, score them, turn them into customers and close deals, with a clear record of
            everything that happens.
          </p>
          <div className="flex flex-col gap-[18px]">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/10 text-accent">
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-[15px] font-bold">{title}</div>
                  <div className="mt-0.5 text-sm text-slate-500">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-[13px] text-slate-500">Nexora CRM · Internal sales platform</div>
      </div>

      <div className="flex flex-col items-center justify-center gap-6 bg-canvas p-4 sm:p-6">
        <div className="lg:hidden">
          <Logo size={40} />
        </div>
        {children}
      </div>
    </div>
  );
}
