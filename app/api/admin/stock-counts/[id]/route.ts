import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// One past count in full, for the history view.
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
    .from("stock_counts")
    .select(
      "id, counted_at, counted_by, stock_count_lines(id, expected_on_shelf, actual_on_shelf, adjustment_applied, books(title, author))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Count not found" }, { status: 404 });
  }

  const lines = (data.stock_count_lines ?? [])
    .map((line) => {
      const book = Array.isArray(line.books) ? line.books[0] : line.books;
      return {
        id: line.id,
        title: book?.title ?? "Unknown book",
        author: book?.author ?? "",
        expected: line.expected_on_shelf,
        actual: line.actual_on_shelf,
        adjustment: line.adjustment_applied,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  return NextResponse.json({
    count: { id: data.id, counted_at: data.counted_at, counted_by: data.counted_by },
    lines,
  });
}
