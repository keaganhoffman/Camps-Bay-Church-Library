import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyMemberPin } from "@/lib/kiosk/verify-pin";
import { dueDateFromNow } from "@/lib/dates";
import { sendReceiptEmail } from "@/lib/email/loan-emails";
import { firstName } from "@/lib/names";

// The borrow confirmation: re-verifies the PIN (never trust the
// browser), checks a copy is actually on the shelf, writes the loan,
// then emails the receipt.
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

  // Loan limit: 3 books out at a time keeps the collection moving.
  const { count: openCount } = await supabase
    .from("loans")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .is("returned_at", null);
  if ((openCount ?? 0) >= 3) {
    return NextResponse.json({ error: "loan-limit" }, { status: 409 });
  }

  // Is a copy still on the shelf? (Someone could have taken the last
  // one while this borrower was deciding.)
  const { data: book, error: bookError } = await supabase
    .from("books_with_availability")
    .select("id, title, author, on_shelf")
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

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .insert({
      member_id: memberId,
      book_id: bookId,
      borrowed_at: borrowedAt.toISOString(),
      due_at: dueAt.toISOString(),
    })
    .select("id")
    .single();

  if (loanError || !loan) {
    return NextResponse.json({ error: "Couldn't save the loan" }, { status: 500 });
  }

  // The receipt email. Awaited so the serverless function doesn't get
  // frozen mid-send, but a failed email never fails the borrow.
  await sendReceiptEmail(supabase, {
    loanId: loan.id,
    to: verification.member.email,
    firstName: firstName(verification.member.full_name),
    bookTitle: book.title,
    bookAuthor: book.author,
    dueAtIso: dueAt.toISOString(),
  });

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
