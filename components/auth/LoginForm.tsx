"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { loadCrm } from "@/lib/crm-store";
import { signIn } from "@/lib/session";
import { btnPrimaryLarge } from "@/lib/ui";
import { isEmail } from "@/lib/utils";

const input =
  "h-[46px] w-full rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-sm outline-none placeholder:text-slate-500 focus:border-accent focus:ring-[3px] focus:ring-accent/20 aria-[invalid=true]:border-error aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-error/15";

/**
 * The demo-account shortcuts (and the demo password) show while developing. In production
 * they're hidden unless NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true, e.g. for a public demo.
 */
const SHOW_DEMO_ACCOUNTS = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === "true";

/**
 * Demo accounts created by the database seeder (php artisan migrate:fresh --seed).
 * Kept inside this expression on purpose: SHOW_DEMO_ACCOUNTS is fixed at build time, so in a
 * normal production build this is `false ? {...} : null` and the password never reaches the
 * JavaScript sent to browsers.
 */
const DEMO = SHOW_DEMO_ACCOUNTS
  ? {
      password: "demo1234",
      accounts: [
        { email: "huma@nexora.example", label: "Admin", sub: "Full access" },
        { email: "omar@nexora.example", label: "Manager", sub: "Team view" },
        { email: "sana@nexora.example", label: "Sales rep", sub: "Own leads" },
      ],
    }
  : null;

/** Only allow redirects back into this app, never to another site. */
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Off by default: unless you tick it, you are signed out when the browser closes.
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const signedIn = useRef(false);

  // With cacheComponents, Next keeps this page alive (hidden) after sign-in instead of
  // unmounting it, so after sign-out it would come back still "Signing in…" with the
  // password filled. Reset when the page is hidden after a successful sign-in.
  useLayoutEffect(() => {
    return () => {
      if (!signedIn.current) return;
      signedIn.current = false;
      setLoading(false);
      setPassword("");
      setShow(false);
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = "Enter your work email.";
    else if (!isEmail(email)) errs.email = "Enter a valid email, like name@company.com.";
    if (!password) errs.password = "Enter your password.";
    setFieldErrors(errs);
    setError("");
    if (Object.keys(errs).length) return;

    setLoading(true);
    const result = await signIn(email, password, remember);
    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }
    // The server records the sign-in in the audit log. Start loading the data now.
    void loadCrm();
    signedIn.current = true;
    router.replace(safeNext());
    router.refresh();
  }

  function fillDemo(demoEmail: string) {
    if (!DEMO) return;
    setEmail(demoEmail);
    setPassword(DEMO.password);
    setError("");
    setFieldErrors({});
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex w-full max-w-[440px] flex-col gap-5 rounded-[22px] border border-line bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-9"
    >
      <div>
        <h2 className="text-[28px] font-extrabold tracking-tight">Welcome back</h2>
        <p className="mt-1.5 text-[14.5px] text-slate-500">Sign in to your Nexora workspace.</p>
      </div>

      {error && (
        <div role="alert" className="flex gap-2.5 rounded-xl border border-hot-border bg-hot-soft px-3.5 py-3 text-[13.5px] leading-snug text-hot">
          <b className="shrink-0">!</b>
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="email" className="text-[13px] font-semibold">
          Work email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={fieldErrors.email || error ? true : undefined}
          className={input}
        />
        {fieldErrors.email && <span className="text-xs font-semibold text-hot">{fieldErrors.email}</span>}
      </div>

      <div className="flex flex-col gap-[7px]">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-[13px] font-semibold">
            Password
          </label>
          <Link href="/forgot-password" className="text-[13px] font-semibold text-primary">
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={fieldErrors.password || error ? true : undefined}
            className={`${input} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1.5 grid h-[34px] w-[34px] place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {fieldErrors.password && <span className="text-xs font-semibold text-hot">{fieldErrors.password}</span>}
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[18px] w-[18px] accent-primary" />
        Keep me signed in on this device
      </label>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className={btnPrimaryLarge}
      >
        {loading && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {DEMO && (
        <>
          <div className="flex items-center gap-3 text-[13px] text-slate-500">
            <div className="h-px flex-1 bg-line" />
            Demo accounts, click to fill
            <div className="h-px flex-1 bg-line" />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {DEMO.accounts.map((d) => {
              const selected = d.email === email.trim().toLowerCase();
              return (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => fillDemo(d.email)}
                  className={`rounded-xl border-[1.5px] px-3 py-2.5 text-left ${selected ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-accent"}`}
                >
                  <div className="text-[13.5px] font-bold">{d.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{d.sub}</div>
                </button>
              );
            })}
          </div>
          <p className="-mt-2 text-center text-xs text-slate-500">
            Demo password: <code className="font-bold text-slate-700">{DEMO.password}</code>
          </p>
        </>
      )}
    </form>
  );
}
