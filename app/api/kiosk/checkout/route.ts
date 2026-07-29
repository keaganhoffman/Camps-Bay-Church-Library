import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyMemberPin } from "@/lib/kiosk/verify-pin";
import { dueDateFromNow } from "@/lib/dates";

// The borrow confirmation: re-verifies the PIN (never trust the
// browser), checks a copy is actually on the shelf, then writes the
// loan. Phase 4 will add the receipt email here.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const memberId = body?.memberId;
  const bookId = body?.bookId;
  const pin = body?.pin;

  if (
    typeof memberId !== "string" ||
    typeof bookId !== "string" ||
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

  // Is a copy still on the shelf? (Someone could have taken the last
  // one while this borrower was deciding.)
  const { data: book, error: bookError } = await supabase
    .from("books_with_availability")
    .select("id, title, on_shelf")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError || !book) {
    return NextResponse.json({ error: "book-not-found" }, { status: 404 });
  }
  if (book.on_shelf <= 0) {
    return NextResponse.json({ error: "all-out" }, { status: 409 });
  }

  const borrowedAt = new Date();
  const dueAt = dueDateFromNow(borrowedAt);

  const { error: loanError } = await supabase.from("loans").insert({
    member_id: memberId,
    book_id: bookId,
    borrowed_at: borrowedAt.toISOString(),
    due_at: dueAt.toISOString(),
  });

  if (loanError) {
    return NextResponse.json({ error: "Couldn't save the loan" }, { status: 500 });
  }

  // Re-read the live count so "copies left" on the success screen is accurate.
  const { data: after } = await supabase
    .from("books_with_availability")
    .select("on_shelf")
    .eq("id", bookId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    bookTitle: book.title,
    memberName: verification.member.full_name,
    dueAt: dueAt.toISOString(),
    copiesLeft: after?.on_shelf ?? book.on_shelf - 1,
  });
}
