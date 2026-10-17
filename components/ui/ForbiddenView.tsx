"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useSessionUser } from "@/lib/session";
import { btnOutline, btnPrimary } from "@/lib/ui";

export default function ForbiddenView() {
  const user = useSessionUser();
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-[480px] flex-col items-center justify-center gap-4 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-warm-bg text-warm">
        <Lock size={28} aria-hidden />
      </span>
      <div className="text-[13px] font-extrabold tracking-[0.08em] text-slate-500">ERROR 403</div>
      <h1 className="text-[28px] font-extrabold tracking-tight">You don’t have access to this page</h1>
      <p className="text-[15px] leading-relaxed text-slate-600">
        Team and roles and the audit log are for admins.
        {user && (
          <>
            {" "}
            You’re signed in as{" "}
            <b>
              {user.name} ({user.role})
            </b>
            .
          </>
        )}{" "}
        Ask an admin if you need access.
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
