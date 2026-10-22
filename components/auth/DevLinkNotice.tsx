"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

/**
 * On a computer without email set up (MAIL_MAILER=log), the API hands back the link it
 * would have emailed (devLink). This shows it with Copy and Open, instead of sending the
 * person testing into the log file. Never shown otherwise: the API only sends devLink locally.
 */
export default function DevLinkNotice({ link, className = "" }: { link: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is shown in full below, so it can still be selected by hand.
    }
  }

  return (
    <div role="status" className={`flex flex-col gap-3 rounded-xl border border-line bg-muted px-3.5 py-3 text-[13px] leading-relaxed ${className}`}>
      <p className="text-slate-700">Email isn’t set up on this computer, so nothing was sent. Here’s the link we would have emailed:</p>
      <code className="block break-all rounded-lg bg-surface px-2.5 py-2 text-xs text-slate-600">{link}</code>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-edge bg-surface px-3 text-[13px] font-semibold hover:bg-slate-50">
          {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-edge bg-surface px-3 text-[13px] font-semibold hover:bg-slate-50">
          <ExternalLink size={15} aria-hidden />
          Open
        </a>
      </div>
      <p className="text-xs text-slate-500">To send real emails, see ‘Sending real emails’ in the README.</p>
    </div>
  );
}
