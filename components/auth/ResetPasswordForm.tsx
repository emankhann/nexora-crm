"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import NewPasswordFields, { checkNewPassword } from "@/components/auth/NewPasswordFields";
import { api, errorMessage, formErrors } from "@/lib/api";

const card = "flex w-full max-w-[440px] flex-col gap-5 rounded-[22px] border border-line bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-8";
const submitCls =
  "flex h-[46px] items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-ink shadow-[0_8px_18px_rgba(46,224,127,0.28)] hover:bg-primary-hover disabled:bg-primary-disabled";

/** Choose a new password from the emailed link (/reset-password?token=…&email=…). */
export default function ResetPasswordForm() {
  // The token and email come from the link in the email. (The page wraps this in <Suspense>.)
  const params = useSearchParams();
  const link = { token: params.get("token") ?? "", email: params.get("email") ?? "" };
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const errs = checkNewPassword(password, confirm);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    setError("");
    try {
      await api.post("/reset-password", { ...link, password, password_confirmation: confirm });
      setDone(true);
    } catch (err) {
      const fields = formErrors(err, { password: "password", password_confirmation: "confirm" } as const);
      if (fields) setErrors(fields);
      else setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!link.token || !link.email) {
    return (
      <div className={card}>
        <h2 className="text-[26px] font-extrabold tracking-tight">This link isn’t complete</h2>
        <p className="text-sm leading-relaxed text-slate-500">Open the link from the email again, or ask for a new one.</p>
        <Link href="/forgot-password" className="text-[13.5px] font-bold text-primary">
          Get a new reset link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div role="status" className={card}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-ok">
          <Check size={18} strokeWidth={2.6} />
        </span>
        <div>
          <h2 className="text-[26px] font-extrabold tracking-tight">Password changed</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">You’ve been signed out everywhere. Sign in with your new password.</p>
        </div>
        <Link href="/login" className={submitCls}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={card}>
      <div>
        <h2 className="text-[26px] font-extrabold tracking-tight">Choose a new password</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">For {link.email}.</p>
      </div>
      {error && (
        <div role="alert" className="rounded-xl border border-hot-border bg-hot-soft px-3.5 py-3 text-[13.5px] leading-snug text-hot">
          {error}{" "}
          <Link href="/forgot-password" className="font-bold underline">
            Get a new link
          </Link>
        </div>
      )}
      <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} errors={errors} />
      <button type="submit" disabled={saving} className={submitCls}>
        {saving && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {saving ? "Saving…" : "Save new password"}
      </button>
      <Link href="/login" className="text-center text-[13px] font-bold text-primary">
        Back to sign in
      </Link>
    </form>
  );
}
