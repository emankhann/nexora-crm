import { Fragment } from "react";
import { Check } from "lucide-react";
import { formatDate } from "@/lib/utils";

const STAGES = ["New", "Contacted", "Qualified", "Customer"];

export default function StageStepper({ current, dates }: { current: number; dates: string[] }) {
  return (
    <div className="flex items-start overflow-x-auto">
      {STAGES.map((name, i) => {
        const done = i < current;
        const isCurrent = i === current;
        const date = dates[i];
        const sub = date ? (Number.isNaN(Date.parse(date)) ? date : formatDate(date)) : i === current + 1 ? "Next step" : "";
        return (
          <Fragment key={name}>
            <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
              <div
                className={`grid h-[26px] w-[26px] place-items-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-primary text-ink"
                    : isCurrent
                    ? "border-2 border-primary bg-surface text-primary"
                    : "border-2 border-edge bg-surface text-slate-500"
                }`}
              >
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </div>
              <div className="text-[12.5px] font-bold">{name}</div>
              <div className="-mt-0.5 min-h-[16px] text-xs text-slate-500">{sub}</div>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`mt-3 h-0.5 flex-1 ${i < current ? "bg-primary" : "bg-line"}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
