import "server-only";
import bcrypt from "bcryptjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearFailures, lockoutRemainingMs, recordFailure } from "./pin-attempts";

export type PinVerification =
  | { status: "ok"; member: { id: string; full_name: string; email: string } }
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "bad-pin" }
  | { status: "not-found" };

/**
 * The single source of truth for "is this member + PIN valid?".
 * Both /api/kiosk/verify-pin (sign-in) and /api/kiosk/checkout use it,
 * so checkout can never be forged with an unverified PIN.
 */
export async function verifyMemberPin(
  supabase: SupabaseClient,
  memberId: string,
  pin: string
): Promise<PinVerification> {
  const lockedMs = lockoutRemainingMs(memberId);
  if (lockedMs > 0) {
    return { status: "locked", retryAfterSeconds: Math.ceil(lockedMs / 1000) };
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, email, pin_hash, is_active")
    .eq("id", memberId)
    .maybeSingle();

  if (!member || !member.is_active) return { status: "not-found" };

  const ok = await bcrypt.compare(pin, member.pin_hash);
  if (!ok) {
    recordFailure(memberId);
    const nowLockedMs = lockoutRemainingMs(memberId);
    if (nowLockedMs > 0) {
      return { status: "locked", retryAfterSeconds: Math.ceil(nowLockedMs / 1000) };
    }
    return { status: "bad-pin" };
  }

  clearFailures(memberId);
  return {
    status: "ok",
    member: { id: member.id, full_name: member.full_name, email: member.email },
  };
}
