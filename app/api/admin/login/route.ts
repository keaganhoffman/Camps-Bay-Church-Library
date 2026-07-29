import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";
import { lockoutRemainingMs, recordFailure, clearFailures } from "@/lib/kiosk/pin-attempts";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, mintAdminCookieValue } from "@/lib/admin/session";

// 6-digit admin PIN check. Same 5-tries-then-5-minute-pause rule as
// member PINs, tracked under a fixed key since there's one admin PIN.
const ADMIN_ATTEMPT_KEY = "admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const pin = body?.pin;
  if (typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const lockedMs = lockoutRemainingMs(ADMIN_ATTEMPT_KEY);
  if (lockedMs > 0) {
    return NextResponse.json(
      { error: "locked", retryAfterSeconds: Math.ceil(lockedMs / 1000) },
      { status: 423 }
    );
  }

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("admin_settings")
    .select("admin_pin_hash")
    .eq("id", true)
    .maybeSingle();

  if (!settings) {
    return NextResponse.json({ error: "admin-not-set-up" }, { status: 500 });
  }

  const ok = await bcrypt.compare(pin, settings.admin_pin_hash);
  if (!ok) {
    recordFailure(ADMIN_ATTEMPT_KEY);
    const nowLocked = lockoutRemainingMs(ADMIN_ATTEMPT_KEY);
    if (nowLocked > 0) {
      return NextResponse.json(
        { error: "locked", retryAfterSeconds: Math.ceil(nowLocked / 1000) },
        { status: 423 }
      );
    }
    return NextResponse.json({ error: "wrong-pin" }, { status: 401 });
  }

  clearFailures(ADMIN_ATTEMPT_KEY);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, mintAdminCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return response;
}
