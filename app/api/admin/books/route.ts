import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("books_with_availability")
    .select("id, title, author, stock_total, on_shelf, is_active, barcode")
    .order("title");
  if (error) return NextResponse.json({ error: "Couldn't load books" }, { status: 500 });
  return NextResponse.json({ books: data });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const author = typeof body?.author === "string" ? body.author.trim() : "";
  const stockTotal = Number(body?.stock_total);
  const barcode = typeof body?.barcode === "string" ? body.barcode.trim() : "";

  if (!title || !author || !Number.isInteger(stockTotal) || stockTotal < 0) {
    return NextResponse.json({ error: "Invalid book details" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("books")
    .insert({ title, author, stock_total: stockTotal, barcode: barcode || null });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Another book already has that barcode" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Couldn't add the book" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
