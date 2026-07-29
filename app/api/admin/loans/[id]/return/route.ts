import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// Manually mark a loan returned — for edge cases like a book left at
// the desk. No thank-you email here: the member didn't do a kiosk
// return, and a surprise email about a desk drop-off would confuse
// more than delight.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;

  const supabase = createServiceClient();
  const { data: loan } = await supabase
    .from("loans")
    .select("id, returned_at")
    .eq("id", id)
    .maybeSingle();

  if (!loan) return NextResponse.json({ error: "loan-not-found" }, { status: 404 });
  if (loan.returned_at !== null) {
    return NextResponse.json({ error: "already-returned" }, { status: 409 });
  }

  const { error } = await supabase
    .from("loans")
    .update({ returned_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't mark it returned" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
