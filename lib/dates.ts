// Loan period and date formatting. South Africa has no daylight
// saving, so "+30 days" arithmetic never shifts an hour.

export const LOAN_DAYS = 30;

export function dueDateFromNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + LOAN_DAYS * 24 * 60 * 60 * 1000);
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
