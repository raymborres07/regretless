export type Tone = "good" | "attention" | "info" | "neutral" | "bad";

export interface StatusInfo {
  label: string;
  tone: Tone;
}

/** Plain-language labels for the backend pipeline states. */
const STATUS: Record<string, StatusInfo> = {
  Purchased: { label: "Added", tone: "neutral" },
  Monitoring: { label: "Watching the price", tone: "neutral" },
  "Price Drop": { label: "Price dropped", tone: "attention" },
  "Checking Policy": { label: "Reading store policy", tone: "info" },
  Eligible: { label: "Ready to claim", tone: "good" },
  "Claim Ready": { label: "Ready to claim", tone: "good" },
  Sending: { label: "Sending request", tone: "info" },
  "Request Sent": { label: "Request sent", tone: "info" },
  "Merchant Replied": { label: "Store replied", tone: "attention" },
  "Refund Approved": { label: "Refund approved", tone: "good" },
  Recovered: { label: "Money back", tone: "good" },
  "Not Eligible": { label: "Not covered", tone: "neutral" },
  Expired: { label: "Window closed", tone: "neutral" },
  "Needs Review": { label: "Needs a quick look", tone: "attention" },
  "Check Failed": { label: "Couldn't check", tone: "bad" },
};

export function statusInfo(status: string): StatusInfo {
  return STATUS[status] ?? { label: status, tone: "neutral" };
}

export const ATTENTION_STATUSES = [
  "Price Drop",
  "Eligible",
  "Claim Ready",
  "Needs Review",
  "Check Failed",
  "Merchant Replied",
  "Refund Approved",
];

export function money(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function errorText(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong. Please try again.";
  return error.message
    .replace(/\[CONVEX[^\]]*\]\s*/g, "")
    .replace(/Server Error\s*/g, "")
    .replace(/^Uncaught Error:\s*/, "")
    .split("\n")[0];
}

export function shortDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} hr ago`;
  const days = Math.floor(diff / DAY);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function daysSince(isoDate: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(`${isoDate}T00:00:00Z`)) / DAY));
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Price difference per unit times quantity, never negative. */
export function priceGap(paid: number, current: number | undefined, quantity = 1): number {
  if (current === undefined || current >= paid) return 0;
  return Math.round((paid - current) * quantity * 100) / 100;
}
