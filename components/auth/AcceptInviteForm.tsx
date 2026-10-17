"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import NewPasswordFields, { checkNewPassword } from "@/components/auth/NewPasswordFields";
import { api, errorMessage, formErrors } from "@/lib/api";
import { mapUser, type ApiUser } from "@/lib/api-mappers";
import { loadCrm } from "@/lib/crm-store";
import { clearSession, setSessionUser } from "@/lib/session";

const card = "flex w-full max-w-[440px] flex-col gap-5 rounded-[22px] border border-line bg-surface p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-8";
const submitCls =
  "flex h-[46px] items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-ink shadow-[0_8px_18px_rgba(46,224,127,0.28)] hover:bg-primary-hover disabled:bg-primary-disabled";

type Invite = { name: string; email: string; role: string };

/** Join the team from the emailed invite (/accept-invite?token=…&email=…): choose a password, then you're in. */
export default function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";

  // null while checking the link; then the invite, or a message if the link doesn't work.
  const [invite, setInvite] = useState<Invite | null>(null);
  const [problem, setProblem] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || !email) return;
    let active = true;
    api
      .post<Invite>("/invites/check", { token, email })
      .then((res) => active && setInvite(res))
      .catch((err) => active && setProblem(formErrors(err, { token: "token" } as const)?.token ?? errorMessage(err)));
    return () => {
      active = false;
    };
  }, [token, email]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const errs = checkNewPassword(password, confirm);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await api.post<{ data: ApiUser }>("/invites/accept", { token, email, password, password_confirmation: confirm });
      // The API has signed them in. Drop anything left from someone else signed in in this browser.
      clearSession();
      setSessionUser(mapUser(res.data), false);
      void loadCrm();
      router.replace("/dashboard");
    } catch (err) {
      const fields = formErrors(err, { password: "password", password_confirmation: "confirm" } as const);
      if (fields) setErrors(fields);
      else setProblem(formErrors(err, { token: "token" } as const)?.token ?? errorMessage(err));
      setSaving(false);
    }
  }

  const missing = !token || !email;
  if (missing || problem) {
    return (
      <div role="alert" className={card}>
        <h2 className="text-[26px] font-extrabold tracking-tight">This invite link doesn’t work</h2>
        <p className="text-sm leading-relaxed text-slate-500">
          {missing ? "The link is incomplete. Open it from the email again." : problem}
        </p>
        <Link href="/login" className="text-[13.5px] font-bold text-primary">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className={card} aria-busy="true">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" aria-hidden /> Checking your invite…
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={card}>
      <div>
        <h2 className="text-[26px] font-extrabold tracking-tight">Welcome, {invite.name.split(" ")[0]}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          You’re joining Nexora as <b className="text-slate-700">{invite.role}</b>. Choose a password for <b className="text-slate-700">{invite.email}</b>.
        </p>
      </div>
      <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} errors={errors} label="Password" />
      <button type="submit" disabled={saving} className={submitCls}>
        {saving && <Loader2 size={18} className="animate-spin" aria-hidden />}
        {saving ? "Joining…" : "Join Nexora"}
      </button>
    </form>
  );
}
