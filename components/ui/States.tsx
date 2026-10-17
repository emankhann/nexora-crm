import type { ReactNode } from "react";
import { AlertTriangle, SearchX } from "lucide-react";

/** Grey shimmer rows shown while data loads. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-[18px] p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="h-[34px] w-[34px] animate-pulse rounded-full bg-[#18201B]" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3 w-3/5 animate-pulse rounded-md bg-[#18201B]" />
            <span className="h-2.5 w-2/5 animate-pulse rounded-md bg-[#18201B]" />
          </span>
          <span className="h-[22px] w-[70px] animate-pulse rounded-full bg-[#18201B]" />
        </div>
      ))}
    </div>
  );
}

/** Full page placeholder while the store hydrates. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading page">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-[#1D2420]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <SkeletonRows rows={6} />
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon ?? <SearchX size={32} className="text-slate-400" aria-hidden />}
      <h3 className="text-[17px] font-extrabold">{title}</h3>
      {body && <p className="max-w-[340px] text-sm leading-relaxed text-slate-600">{body}</p>}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-[#2A1312] text-[#FF8F84]">
        <AlertTriangle size={28} aria-hidden />
      </span>
      <h3 className="text-[19px] font-extrabold">{title}</h3>
      {body && <p className="max-w-[340px] text-sm leading-relaxed text-slate-600">{body}</p>}
      {action}
    </div>
  );
}
