"use client";

import { TextField } from "@/components/ui/Field";

/** Rules shown under the fields; the API checks the same ones (AuthController::passwordRules). */
export const PASSWORD_HINT = "At least 8 characters, with letters and numbers.";

/** Checks a new password the same way the API does, for instant feedback. */
export function checkNewPassword(password: string, confirm: string): { password?: string; confirm?: string } {
  const errors: { password?: string; confirm?: string } = {};
  if (password.length < 8 || !/[a-z]/i.test(password) || !/\d/.test(password)) errors.password = PASSWORD_HINT;
  if (confirm !== password) errors.confirm = "The passwords don’t match.";
  return errors;
}

/** "New password" and "Confirm new password", used by reset password, accept invite and change password. */
export default function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  errors,
  label = "New password",
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  errors: { password?: string; confirm?: string };
  label?: string;
}) {
  return (
    <>
      <TextField
        label={label}
        required
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => onPassword(e.target.value)}
        error={errors.password}
        hint={PASSWORD_HINT}
      />
      <TextField
        label="Confirm new password"
        required
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => onConfirm(e.target.value)}
        error={errors.confirm}
      />
    </>
  );
}
