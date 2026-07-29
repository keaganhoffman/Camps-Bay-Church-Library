import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// Edit or deactivate one book. Only the provided fields change.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const updates: Record<string, unknown> = {};
  if (typeof body?.title === "string" && body.title.trim()) updates.title = body.title.trim();
  if (typeof body?.author === "string" && body.author.trim()) updates.author = body.author.trim();
  if (body?.stock_total !== undefined) {
    const stockTotal = Number(body.stock_total);
    if (!Number.isInteger(stockTotal) || stockTotal < 0) {
      return NextResponse.json({ error: "Invalid stock number" }, { status: 400 });
    }
    updates.stock_total = stockTotal;
  }
  if (typeof body?.is_active === "boolean") updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("books").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't update the book" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
