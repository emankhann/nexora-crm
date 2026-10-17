"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { inputCls, textareaCls } from "@/lib/ui";

type Base = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
};

function Shell({ id, label, required, error, hint, className, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-[7px] ${className ?? ""}`}>
      <label htmlFor={id} className="text-[13px] font-bold text-slate-800">
        {label}
        {required && <span className="text-hot"> *</span>}
      </label>
      {children}
      {error ? (
        <span id={`${id}-err`} className="text-xs font-semibold text-hot">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-slate-500">{hint}</span>
      ) : null}
    </div>
  );
}

export function TextField({ label, required, error, hint, className, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        aria-required={required || undefined}
        className={inputCls}
        {...rest}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  required,
  error,
  hint,
  className,
  options,
  ...rest
}: Base & SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[] }) {
  const id = useId();
  return (
    <Shell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <select id={id} aria-invalid={error ? true : undefined} className={inputCls} {...rest}>
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )
        )}
      </select>
    </Shell>
  );
}

export function TextAreaField({ label, required, error, hint, className, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} required={required} error={error} hint={hint} className={className}>
      <textarea id={id} aria-invalid={error ? true : undefined} className={textareaCls} rows={3} {...rest} />
    </Shell>
  );
}

/** Field-level errors keyed by field name. Empty object = valid. */
export type Errors<T extends string> = Partial<Record<T, string>>;
