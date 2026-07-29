import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Past counts, newest first, with a discrepancy tally each.
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("stock_counts")
    .select("id, counted_at, counted_by, stock_count_lines(adjustment_applied)")
    .order("counted_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Couldn't load counts" }, { status: 500 });

  const counts = (data ?? []).map((row) => ({
    id: row.id,
    counted_at: row.counted_at,
    counted_by: row.counted_by,
    booksCounted: row.stock_count_lines?.length ?? 0,
    discrepancies: (row.stock_count_lines ?? []).filter(
      (l: { adjustment_applied: number }) => l.adjustment_applied !== 0
    ).length,
  }));

  return NextResponse.json({ counts });
}

// Save a completed count: writes the stock_counts row, one line per
// book, and applies stock_total adjustments where the physical count
// disagreed with the system.
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const countedBy = typeof body?.counted_by === "string" ? body.counted_by.trim() : "";
  const rawLines = Array.isArray(body?.lines) ? body.lines : null;

  if (!countedBy || !rawLines || rawLines.length === 0 || rawLines.length > 1000) {
    return NextResponse.json({ error: "Invalid count" }, { status: 400 });
  }

  const lines: { book_id: string; expected_on_shelf: number; actual_on_shelf: number }[] = [];
  for (const raw of rawLines as Record<string, unknown>[]) {
    const bookId = raw?.book_id;
    const expected = Number(raw?.expected_on_shelf);
    const actual = Number(raw?.actual_on_shelf);
    if (
      typeof bookId !== "string" ||
      !Number.isInteger(expected) ||
      !Number.isInteger(actual) ||
      actual < 0
    ) {
      return NextResponse.json({ error: "Invalid count line" }, { status: 400 });
    }
    lines.push({ book_id: bookId, expected_on_shelf: expected, actual_on_shelf: actual });
  }

  const supabase = createServiceClient();
  const { data: count, error: countError } = await supabase
    .from("stock_counts")
    .insert({ counted_by: countedBy })
    .select("id")
    .single();
  if (countError || !count) {
    return NextResponse.json({ error: "Couldn't start saving the count" }, { status: 500 });
  }

  const { error: linesError } = await supabase.from("stock_count_lines").insert(
    lines.map((l) => ({
      stock_count_id: count.id,
      book_id: l.book_id,
      expected_on_shelf: l.expected_on_shelf,
      actual_on_shelf: l.actual_on_shelf,
      adjustment_applied: l.actual_on_shelf - l.expected_on_shelf,
    }))
  );
  if (linesError) {
    return NextResponse.json({ error: "Couldn't save the count lines" }, { status: 500 });
  }

  // Apply adjustments: a book found short loses stock_total, a book
  // found over gains it. Never below zero.
  const adjustments = lines.filter((l) => l.actual_on_shelf !== l.expected_on_shelf);
  let applied = 0;
  if (adjustments.length > 0) {
    const { data: books, error: booksError } = await supabase
      .from("books")
      .select("id, stock_total")
      .in("id", adjustments.map((a) => a.book_id));
    if (booksError) {
      return NextResponse.json({ error: "Count saved but adjustments failed" }, { status: 500 });
    }
    const stockById = new Map((books ?? []).map((b) => [b.id, b.stock_total]));
    for (const adj of adjustments) {
      const current = stockById.get(adj.book_id);
      if (current === undefined) continue;
      const delta = adj.actual_on_shelf - adj.expected_on_shelf;
      const { error: updateError } = await supabase
        .from("books")
        .update({ stock_total: Math.max(0, current + delta) })
        .eq("id", adj.book_id);
      if (!updateError) applied++;
    }
  }

  return NextResponse.json({
    ok: true,
    countId: count.id,
    booksCounted: lines.length,
    adjustmentsApplied: applied,
  });
}
