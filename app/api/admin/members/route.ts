import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const supabase = createServiceClient();
  // Deliberately never selects pin_hash — hashes stay in the database.
  const { data, error } = await supabase
    .from("members")
    .select("id, full_name, email, is_active, created_at")
    .order("full_name");
  if (error) return NextResponse.json({ error: "Couldn't load members" }, { status: 500 });
  return NextResponse.json({ members: data });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const pin = body?.pin;

  if (!fullName || !email.includes("@") || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "Needs a name, a valid email, and a 4-digit PIN" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("members").insert({
    full_name: fullName,
    email,
    pin_hash: await bcrypt.hash(pin, 10),
  });
  if (error) {
    const duplicate = error.code === "23505"; // unique constraint on email
    return NextResponse.json(
      { error: duplicate ? "That email is already a member" : "Couldn't add the member" },
      { status: duplicate ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
