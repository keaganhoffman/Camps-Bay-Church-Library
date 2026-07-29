import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";

// Guest self-signup from the kiosk: name + surname, email, 4-digit
// PIN. Creates an active member exactly like an admin-created one —
// the PIN is stored only as a bcrypt hash.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
  const surname = typeof body?.surname === "string" ? body.surname.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const pin = body?.pin;

  if (
    !firstName ||
    !surname ||
    !email.includes("@") ||
    typeof pin !== "string" ||
    !/^\d{4}$/.test(pin)
  ) {
    return NextResponse.json(
      { error: "Please fill in your name, surname, a valid email, and a 4-digit PIN." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("members").insert({
    full_name: `${firstName} ${surname}`,
    email,
    pin_hash: await bcrypt.hash(pin, 10),
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That email already has an account. If you've forgotten your PIN, ask at the desk to reset it." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong creating your account — please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, firstName });
}
