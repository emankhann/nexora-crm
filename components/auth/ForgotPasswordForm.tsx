"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { isEmail } from "@/lib/utils";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) {
      setError("Enter a valid email, like name@company.com.");
      return;
    }
    setError("");
    setLoading(true);
    // The backend will email a one-time link here. We always show the same
    // message so nobody can use this form to find out which emails exist.
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-5 rounded-[22px] border border-line bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-8">
      <Link href="/login" className="text-[13px] font-bold text-primary">
        ← Back to sign in
      </Link>
      {sent ? (
        <div role="status" className="flex gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-ok">
            <Check size={18} strokeWidth={2.6} />
          </span>
          <div>
            <h2 className="text-xl font-extrabold">Check your email</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
              If <b>{email}</b> has an account, a reset link is on its way. It works for 30 minutes.{" "}
              <button type="button" onClick={() => setSent(false)} className="font-bold text-primary">
                Send again
              </button>
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <div>
            <h2 className="text-[26px] font-extrabold tracking-tight">Reset your password</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Enter your work email and we’ll send you a link to choose a new password.
            </p>
          </div>
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="reset-email" className="text-[13px] font-semibold">
              Work email
            </label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              placeholder="you@company.com"
              className="h-[46px] w-full rounded-xl border-[1.5px] border-line px-3.5 text-sm outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20 aria-[invalid=true]:border-error"
            />
            {error && <span className="text-xs font-semibold text-hot">{error}</span>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex h-[46px] items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-ink shadow-[0_8px_18px_rgba(46,224,127,0.28)] disabled:bg-primary-disabled"
          >
            {loading && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </div>
  );
}
