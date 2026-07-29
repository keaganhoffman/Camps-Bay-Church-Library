import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// All open loans with borrower and book attached, oldest due first.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("loans")
    .select("id, borrowed_at, due_at, members(full_name), books(title)")
    .is("returned_at", null)
    .order("due_at");
  if (error) return NextResponse.json({ error: "Couldn't load loans" }, { status: 500 });

  const loans = (data ?? []).map((row) => {
    const member = Array.isArray(row.members) ? row.members[0] : row.members;
    const book = Array.isArray(row.books) ? row.books[0] : row.books;
    return {
      id: row.id,
      borrowed_at: row.borrowed_at,
      due_at: row.due_at,
      member_name: member?.full_name ?? "Unknown member",
      book_title: book?.title ?? "Unknown book",
    };
  });

  return NextResponse.json({ loans });
}
