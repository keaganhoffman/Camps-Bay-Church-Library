import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// One member's full borrowing history, newest first.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("loans")
    .select("id, borrowed_at, due_at, returned_at, lost_at, books(title)")
    .eq("member_id", id)
    .order("borrowed_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Couldn't load history" }, { status: 500 });

  const loans = (data ?? []).map((row) => {
    const book = Array.isArray(row.books) ? row.books[0] : row.books;
    return {
      id: row.id,
      title: book?.title ?? "Unknown book",
      borrowed_at: row.borrowed_at,
      due_at: row.due_at,
      returned_at: row.returned_at,
      lost: row.lost_at !== null,
    };
  });

  return NextResponse.json({ loans });
}
