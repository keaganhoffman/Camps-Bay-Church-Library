import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyMemberPin } from "@/lib/kiosk/verify-pin";

// A member's open loans, for the return flow. POST (not GET) because
// it needs the PIN — who has which books out isn't public information.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const memberId = body?.memberId;
  const pin = body?.pin;

  if (typeof memberId !== "string" || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const verification = await verifyMemberPin(supabase, memberId, pin);
  if (verification.status !== "ok") {
    return NextResponse.json({ error: "not-authorised" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("loans")
    .select("id, due_at, books(title, author)")
    .eq("member_id", memberId)
    .is("returned_at", null)
    .order("due_at");

  if (error) {
    return NextResponse.json({ error: "Couldn't load loans" }, { status: 500 });
  }

  const loans = (data ?? []).map((loan) => {
    // The books fk join arrives as an object (or array of one).
    const book = Array.isArray(loan.books) ? loan.books[0] : loan.books;
    return {
      id: loan.id,
      due_at: loan.due_at,
      title: book?.title ?? "Unknown book",
      author: book?.author ?? "",
    };
  });

  return NextResponse.json({ loans });
}
