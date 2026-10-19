/**
 * While developing, the API writes emails to its log instead of sending them
 * (MAIL_MAILER=log). This tells the person testing where to find the link.
 * Hidden in production builds, and when NEXT_PUBLIC_EMAILS_IN_LOG=false because the API
 * sends real emails (MAIL_MAILER=smtp).
 */
const EMAILS_IN_LOG = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_EMAILS_IN_LOG !== "false";

export default function EmailLogHint({ className = "" }: { className?: string }) {
  if (!EMAILS_IN_LOG) return null;
  return (
    <p className={`rounded-xl border border-line bg-muted px-3.5 py-2.5 text-xs leading-relaxed text-slate-500 ${className}`}>
      <b className="text-slate-700">Running locally:</b> emails aren’t really sent. Open <code className="text-slate-700">backend/storage/logs/laravel.log</code>{" "}
      and look for the last line starting with <code className="text-slate-700">Email link</code>.
    </p>
  );
}
