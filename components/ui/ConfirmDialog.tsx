"use client";

import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useErrorToast } from "@/components/ui/Toast";
import { btnDanger, btnOutline } from "@/lib/ui";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  /** May return a promise: the dialog waits, and stays open with an error toast if it fails. */
  onConfirm: () => void | Promise<void>;
  title: string;
  body: ReactNode;
  confirmLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const showError = useErrorToast();

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      alert
      icon={
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-hot-bg text-hot">
          <Trash2 size={20} />
        </span>
      }
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btnDanger} onClick={() => void confirm()} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-[13.5px] leading-relaxed text-slate-600">{body}</div>
    </Modal>
  );
}
