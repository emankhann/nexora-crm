"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";

type Toast = {
  id: number;
  message: string;
  tone: "success" | "error";
  action?: { label: string; onClick: () => void };
};

type ToastFn = (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastFn>(
    (message, opts) => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-2), { id, message, tone: opts?.tone ?? "success", action: opts?.action }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2.5 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full items-center gap-3 rounded-[14px] px-4 py-3.5 shadow-[0_16px_36px_rgba(2,8,23,0.25)] ${
              t.tone === "success" ? "bg-navy text-white" : "border border-[#F7C9C3] bg-white text-navy"
            }`}
          >
            <span
              className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full ${
                t.tone === "success" ? "bg-[#22A05A] text-white" : "bg-[#FDE4E4] text-[#B42318]"
              }`}
            >
              {t.tone === "success" ? <Check size={14} strokeWidth={3} /> : <span className="text-sm font-extrabold">!</span>}
            </span>
            <span className="flex-1 text-[13.5px] font-semibold">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="text-[13.5px] font-bold text-[#9DB8FF] hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
