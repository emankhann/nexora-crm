"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** "center" for dialogs, "right" for slide-over panels. */
  variant?: "center" | "right";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  /** Render as an alert dialog (for destructive confirmations). */
  alert?: boolean;
};

const widths = { sm: "max-w-[440px]", md: "max-w-[600px]", lg: "max-w-[680px]" };

/**
 * Modal dialog and slide-over panel built on the native <dialog> element,
 * which gives focus trapping, Esc to close and a backdrop for free.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "center",
  size = "md",
  icon,
  alert = false,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const right = variant === "right";

  return (
    <dialog
      ref={ref}
      role={alert ? "alertdialog" : "dialog"}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) onClose();
      }}
      className={
        right
          ? "m-0 ml-auto h-dvh max-h-dvh w-full max-w-[520px] bg-transparent p-0 backdrop:bg-[#000000]/45"
          : `m-auto w-[calc(100%-32px)] ${widths[size]} max-h-[calc(100dvh-32px)] rounded-[20px] bg-transparent p-0 backdrop:bg-[#000000]/50`
      }
    >
      {open && (
        <div
          className={`flex flex-col bg-surface text-navy ${
            right ? "h-full shadow-[-20px_0_50px_rgba(2,8,23,0.25)]" : "max-h-[calc(100dvh-32px)] rounded-[20px] shadow-[0_30px_70px_rgba(2,8,23,0.35)]"
          }`}
        >
          <div className="flex items-start justify-between gap-4 border-b border-[#18201B] px-6 pb-[18px] pt-[22px]">
            <div className="flex min-w-0 items-start gap-3.5">
              {icon}
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
                {description && <div className="mt-1 text-[13px] text-slate-500">{description}</div>}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[#26302A] bg-surface hover:bg-slate-50"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#18201B] bg-[#151B17] px-6 py-4 ${
                right ? "" : "rounded-b-[20px]"
              }`}
            >
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
