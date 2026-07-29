import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyMemberPin } from "@/lib/kiosk/verify-pin";

// Sign-in step: check a member's 4-digit PIN.
// Wrong PIN → 401 (kiosk shakes the dots). Five wrong attempts →
// 423 "locked" for 5 minutes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const memberId = body?.memberId;
  const pin = body?.pin;

  if (typeof memberId !== "string" || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const result = await verifyMemberPin(supabase, memberId, pin);

  switch (result.status) {
    case "ok":
      return NextResponse.json({ ok: true });
    case "locked":
      return NextResponse.json(
        { error: "locked", retryAfterSeconds: result.retryAfterSeconds },
        { status: 423 }
      );
    case "bad-pin":
      return NextResponse.json({ error: "wrong-pin" }, { status: 401 });
    case "not-found":
      return NextResponse.json({ error: "member-not-found" }, { status: 404 });
  }
}
