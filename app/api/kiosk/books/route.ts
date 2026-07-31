import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Book list with live "on shelf" counts from the
// books_with_availability view (stock_total minus open loans).
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("books_with_availability")
    .select("id, title, author, on_shelf, barcode")
    .eq("is_active", true) // deactivated books never appear on the kiosk
    .order("title");

  if (error) {
    return NextResponse.json({ error: "Couldn't load books" }, { status: 500 });
  }
  return NextResponse.json({ books: data });
}
