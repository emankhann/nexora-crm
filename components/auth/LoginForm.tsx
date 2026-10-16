"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { recordSignIn } from "@/lib/crm-store";
import { signIn } from "@/lib/session";
import { DEMO_PASSWORD, users } from "@/lib/users";
import { isEmail } from "@/lib/utils";

const input =
  "h-[46px] w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 text-sm outline-none placeholder:text-slate-500 focus:border-accent focus:ring-[3px] focus:ring-accent/20 aria-[invalid=true]:border-[#D92D20] aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-[#D92D20]/15";

const demoAccounts = [
  { userId: "u1", label: "Admin", sub: "Full access" },
  { userId: "u2", label: "Manager", sub: "Team view" },
  { userId: "u3", label: "Sales rep", sub: "Own leads" },
];

/** Only allow redirects back into this app, never to another site. */
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

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
    recordSignIn(result.user);
    router.replace(safeNext());
    router.refresh();
  }

  function fillDemo(userId: string) {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    setEmail(u.email);
    setPassword(DEMO_PASSWORD);
    setError("");
    setFieldErrors({});
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex w-full max-w-[440px] flex-col gap-5 rounded-[22px] border border-line bg-white p-6 shadow-[0_24px_60px_rgba(17,28,53,0.08)] sm:p-9"
    >
      <div>
        <h2 className="text-[28px] font-extrabold tracking-tight">Welcome back</h2>
        <p className="mt-1.5 text-[14.5px] text-slate-500">Sign in to your Nexora workspace.</p>
      </div>

      {error && (
        <div role="alert" className="flex gap-2.5 rounded-xl border border-[#F7C9C3] bg-[#FEF3F2] px-3.5 py-3 text-[13.5px] leading-snug text-[#8F1D14]">
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
        {fieldErrors.email && <span className="text-xs font-semibold text-[#B42318]">{fieldErrors.email}</span>}
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
        {fieldErrors.password && <span className="text-xs font-semibold text-[#B42318]">{fieldErrors.password}</span>}
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[18px] w-[18px] accent-primary" />
        Keep me signed in on this device
      </label>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="flex h-[46px] items-center justify-center gap-2.5 rounded-xl bg-primary text-[15px] font-bold text-white shadow-[0_8px_18px_rgba(53,109,243,0.28)] hover:bg-[#2D5FDB] disabled:cursor-progress disabled:bg-[#7EA2F7]"
      >
        {loading && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <div className="flex items-center gap-3 text-[13px] text-slate-500">
        <div className="h-px flex-1 bg-line" />
        Demo accounts, click to fill
        <div className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {demoAccounts.map((d) => {
          const selected = users.find((u) => u.id === d.userId)?.email === email;
          return (
            <button
              key={d.userId}
              type="button"
              onClick={() => fillDemo(d.userId)}
              className={`rounded-xl border-[1.5px] px-3 py-2.5 text-left ${selected ? "border-primary bg-[#F0F4FF]" : "border-line bg-white hover:border-accent"}`}
            >
              <div className="text-[13.5px] font-bold">{d.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{d.sub}</div>
            </button>
          );
        })}
      </div>
      <p className="-mt-2 text-center text-xs text-slate-500">
        Demo password: <code className="font-bold text-slate-700">{DEMO_PASSWORD}</code>
      </p>
    </form>
  );
}
