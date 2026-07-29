import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// Edit a member, deactivate them, or reset their PIN (send { pin }).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const updates: Record<string, unknown> = {};
  if (typeof body?.full_name === "string" && body.full_name.trim()) {
    updates.full_name = body.full_name.trim();
  }
  if (typeof body?.email === "string" && body.email.trim()) {
    const email = body.email.trim().toLowerCase();
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    updates.email = email;
  }
  if (typeof body?.is_active === "boolean") updates.is_active = body.is_active;
  if (body?.pin !== undefined) {
    if (typeof body.pin !== "string" || !/^\d{4}$/.test(body.pin)) {
      return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });
    }
    updates.pin_hash = await bcrypt.hash(body.pin, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("members").update(updates).eq("id", id);
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "That email is already a member" : "Couldn't update the member" },
      { status: duplicate ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
