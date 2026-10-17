"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { TextField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import NewPasswordFields, { checkNewPassword } from "@/components/auth/NewPasswordFields";
import { api, errorMessage, formErrors } from "@/lib/api";
import { btnOutline, btnPrimary } from "@/lib/ui";

type Errors = { current?: string; password?: string; confirm?: string };

/** Change your own password (account menu). Signs you out on your other devices. */
export default function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const errs: Errors = { ...checkNewPassword(password, confirm) };
    if (!current) errs.current = "Enter your current password.";
    else if (password && password === current) errs.password = "Choose a password you haven’t been using.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await api.put("/me/password", { current_password: current, password, password_confirmation: confirm });
      toast("Password changed. You’ve been signed out on your other devices.");
      onClose();
    } catch (err) {
      const fields = formErrors(err, { current_password: "current", password: "password", password_confirmation: "confirm" } as const);
      if (fields) setErrors(fields);
      else toast(errorMessage(err), { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Change password"
      icon={
        <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <KeyRound size={20} />
        </span>
      }
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="change-password-form" className={btnPrimary} disabled={saving}>
            {saving ? "Saving…" : "Change password"}
          </button>
        </div>
      }
    >
      <form id="change-password-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Current password"
          required
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.current}
        />
        <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} errors={errors} />
      </form>
    </Modal>
  );
}
