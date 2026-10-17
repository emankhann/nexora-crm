"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
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
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      alert
      icon={
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#2A1312] text-[#FF8F84]">
          <Trash2 size={20} />
        </span>
      }
      footer={
        <div className="ml-auto flex gap-2.5">
          <button type="button" className={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={btnDanger}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-[13.5px] leading-relaxed text-slate-600">{body}</div>
    </Modal>
  );
}
