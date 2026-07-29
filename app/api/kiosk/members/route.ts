import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Active members for the kiosk sign-in list. Names only — the kiosk
// screen has no business seeing emails or PIN hashes.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: "Couldn't load members" }, { status: 500 });
  }
  return NextResponse.json({ members: data });
}
