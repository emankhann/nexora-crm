export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function scoreTier(score: number) {
  if (score >= 80)
    return { key: "hot", label: "Hot", bar: "bg-error", text: "text-hot" } as const;
  if (score >= 50)
    return { key: "warm", label: "Warm", bar: "bg-warm-bar", text: "text-warm" } as const;
  return { key: "cold", label: "Cold", bar: "bg-accent", text: "text-cold" } as const;
}

/* ---------- ids and names ---------- */

/* ---------- dates ---------- */

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(fromIso: string, to = new Date()) {
  return Math.round((startOfDay(to).getTime() - startOfDay(new Date(fromIso)).getTime()) / DAY);
}

export function isSameDay(iso: string, ref = new Date()) {
  return startOfDay(new Date(iso)).getTime() === startOfDay(ref).getTime();
}

/** "Oct 16" (adds the year when it isn't this year). */
export function formatDate(iso: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "Today, 5:00 PM", "Tomorrow, 10:00 AM", "Oct 19, 10:00 AM" */
export function formatDue(iso: string) {
  const diff = -daysBetween(iso);
  const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : formatDate(iso);
  return `${day}, ${formatTime(iso)}`;
}

/** "Just now", "12 minutes ago", "3 hours ago", "Yesterday", "4 days ago", "Oct 2" */
export function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hours = Math.round(min / 60);
  if (hours < 24 && isSameDay(iso)) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = daysBetween(iso);
  if (days <= 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** Value for <input type="date">, in local time. */
export function toDateInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Value for <input type="time">, in local time. */
export function toTimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Combine date and time inputs into an ISO string. */
export function fromInputs(date: string, time = "09:00") {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0).toISOString();
}

/** Now plus a number of days, at a given hour. Used for seed data and defaults. */
export function daysFromNow(days: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/* ---------- validation ---------- */

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isPhone(value: string) {
  return value.trim() === "" || /^[+()\d\s-]{7,20}$/.test(value.trim());
}

/** "12,500" or "$12,500" → 12500; returns NaN when it isn't a number. */
export function parseMoney(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}
