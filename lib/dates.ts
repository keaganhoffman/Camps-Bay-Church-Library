// Loan period and date formatting. South Africa has no daylight
// saving, so "+30 days" arithmetic never shifts an hour.

export const LOAN_DAYS = 30;

export function dueDateFromNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + LOAN_DAYS * 24 * 60 * 60 * 1000);
}

/** "28 Aug" in South African time — for compact due-date badges. */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

/** Whole days overdue (at least 1 once due_at has passed); 0 if not overdue yet. */
export function daysLate(dueAtIso: string, now: Date = new Date()): number {
  const msLate = now.getTime() - new Date(dueAtIso).getTime();
  if (msLate <= 0) return 0;
  return Math.max(1, Math.ceil(msLate / (24 * 60 * 60 * 1000)));
}

/**
 * Midnight at the start of today in SAST (UTC+2, no daylight saving),
 * regardless of the server's own timezone. Used for "at most one
 * overdue email per loan per calendar day".
 */
export function startOfTodaySAST(now: Date = new Date()): Date {
  const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + SAST_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      SAST_OFFSET_MS
  );
}

/** "Friday, 28 August 2026" in South African time, whatever timezone the server runs in. */
export function formatFriendlyDate(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
