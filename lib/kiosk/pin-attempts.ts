// Failed-PIN tracking: after 5 wrong attempts for a member, pause
// that member's attempts for 5 minutes.
//
// This lives in server memory, not the database. On Vercel that means
// a lockout could reset if the serverless instance recycles — for a
// single trusted kiosk inside the church this is the right trade-off
// (the brief calls PINs convenience-level security), and it keeps the
// Phase 1 schema untouched.

type Entry = { fails: number; lockedUntil: number | null };

const attempts = new Map<string, Entry>();

const MAX_FAILS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

/** Milliseconds until this member may try again; 0 if not locked. */
export function lockoutRemainingMs(memberId: string): number {
  const entry = attempts.get(memberId);
  if (!entry?.lockedUntil) return 0;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) {
    attempts.delete(memberId); // lockout expired — clean slate
    return 0;
  }
  return remaining;
}

export function recordFailure(memberId: string): void {
  const entry = attempts.get(memberId) ?? { fails: 0, lockedUntil: null };
  entry.fails += 1;
  if (entry.fails >= MAX_FAILS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.fails = 0;
  }
  attempts.set(memberId, entry);
}

export function clearFailures(memberId: string): void {
  attempts.delete(memberId);
}
