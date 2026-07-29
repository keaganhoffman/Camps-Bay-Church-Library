import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// Mark an open loan as lost: closes the loan (returned_at + lost_at)
// and reduces the book's stock_total by one, so shelf counts stay
// truthful. This also stops the daily overdue emails for that loan.
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
    .select("id, book_id, returned_at")
    .eq("id", id)
    .maybeSingle();

  if (!loan) return NextResponse.json({ error: "loan-not-found" }, { status: 404 });
  if (loan.returned_at !== null) {
    return NextResponse.json({ error: "already-closed" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: loanError } = await supabase
    .from("loans")
    .update({ returned_at: now, lost_at: now })
    .eq("id", id);
  if (loanError) {
    return NextResponse.json({ error: "Couldn't mark it lost" }, { status: 500 });
  }

  const { data: book } = await supabase
    .from("books")
    .select("id, stock_total")
    .eq("id", loan.book_id)
    .maybeSingle();
  if (book) {
    await supabase
      .from("books")
      .update({ stock_total: Math.max(0, book.stock_total - 1) })
      .eq("id", book.id);
  }

  return NextResponse.json({ ok: true });
}
