import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// Bulk import for the initial ~200-title load.
// Expects { rows: [{ title, author, stock_total, barcode? }] }.
// A row whose title+author (or barcode) already exists is skipped,
// so re-importing the same file can't create duplicates.
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows : null;
  if (!rows || rows.length === 0 || rows.length > 1000) {
    return NextResponse.json({ error: "Send between 1 and 1000 rows" }, { status: 400 });
  }

  const cleaned: {
    title: string;
    author: string;
    stock_total: number;
    barcode: string | null;
  }[] = [];
  const errors: string[] = [];
  rows.forEach((row: Record<string, unknown>, i: number) => {
    const title = typeof row?.title === "string" ? row.title.trim() : "";
    const author = typeof row?.author === "string" ? row.author.trim() : "";
    const stockTotal = Number(row?.stock_total);
    const barcode = typeof row?.barcode === "string" ? row.barcode.trim() : "";
    if (!title || !author || !Number.isInteger(stockTotal) || stockTotal < 0) {
      errors.push(`Row ${i + 1}: needs title, author and a whole-number stock_total`);
      return;
    }
    cleaned.push({ title, author, stock_total: stockTotal, barcode: barcode || null });
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: "Some rows are invalid", details: errors }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("books")
    .select("title, author, barcode");
  if (existingError) {
    return NextResponse.json({ error: "Couldn't check existing books" }, { status: 500 });
  }

  const existingKeys = new Set(
    (existing ?? []).map((b) => `${b.title.toLowerCase()}|${b.author.toLowerCase()}`)
  );
  const existingBarcodes = new Set(
    (existing ?? []).map((b) => b.barcode).filter(Boolean)
  );
  const seenBarcodes = new Set<string>();
  const toInsert = cleaned.filter((b) => {
    if (existingKeys.has(`${b.title.toLowerCase()}|${b.author.toLowerCase()}`)) return false;
    if (b.barcode) {
      // A barcode may only appear once — in the database or the file.
      if (existingBarcodes.has(b.barcode) || seenBarcodes.has(b.barcode)) return false;
      seenBarcodes.add(b.barcode);
    }
    return true;
  });

  if (toInsert.length > 0) {
    const { error } = await supabase.from("books").insert(toInsert);
    if (error) return NextResponse.json({ error: "Import failed while saving" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported: toInsert.length,
    skippedAsDuplicates: cleaned.length - toInsert.length,
  });
}
