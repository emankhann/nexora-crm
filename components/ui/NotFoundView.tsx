import Link from "next/link";
import { btnOutline, btnPrimary } from "@/lib/ui";

export default function NotFoundView() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-[520px] flex-col items-center justify-center gap-4 text-center">
      <div className="text-[96px] font-extrabold leading-none tracking-[-0.05em] text-edge-strong">404</div>
      <h1 className="text-[28px] font-extrabold tracking-tight">We couldn’t find that page</h1>
      <p className="text-[15px] leading-relaxed text-slate-600">
        The lead, customer or deal may have been deleted, or the link is wrong. Press Ctrl K to search for it.
      </p>
      <div className="mt-1 flex gap-2.5">
        <Link href="/dashboard" className={btnPrimary}>
          Go to dashboard
        </Link>
        <Link href="/leads" className={btnOutline}>
          Open leads
        </Link>
      </div>
    </section>
  );
}
