import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyMemberPin } from "@/lib/kiosk/verify-pin";

// The return confirmation: re-verifies the PIN, checks the loan really
// belongs to this member and is still open, then stamps returned_at.
// Phase 4 will add the thank-you email here.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const memberId = body?.memberId;
  const loanId = body?.loanId;
  const pin = body?.pin;

  if (
    typeof memberId !== "string" ||
    typeof loanId !== "string" ||
    typeof pin !== "string" ||
    !/^\d{4}$/.test(pin)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const verification = await verifyMemberPin(supabase, memberId, pin);
  if (verification.status !== "ok") {
    return NextResponse.json({ error: "not-authorised" }, { status: 401 });
  }

  const { data: loan } = await supabase
    .from("loans")
    .select("id, member_id, returned_at, books(title)")
    .eq("id", loanId)
    .maybeSingle();

  if (!loan || loan.member_id !== memberId) {
    return NextResponse.json({ error: "loan-not-found" }, { status: 404 });
  }
  if (loan.returned_at !== null) {
    return NextResponse.json({ error: "already-returned" }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("loans")
    .update({ returned_at: new Date().toISOString() })
    .eq("id", loanId);

  if (updateError) {
    return NextResponse.json({ error: "Couldn't save the return" }, { status: 500 });
  }

  // Does this member have anything else out? Lets the success screen
  // say "you're all square" when the answer is no.
  const { count } = await supabase
    .from("loans")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .is("returned_at", null);

  const book = Array.isArray(loan.books) ? loan.books[0] : loan.books;

  return NextResponse.json({
    ok: true,
    bookTitle: book?.title ?? "the book",
    remainingLoans: count ?? 0,
  });
}
