import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// Bulk member import. Expects { rows: [{ full_name, email, pin }] }.
// PINs are bcrypt-hashed here on the server; an email that already
// exists is skipped, so re-importing the same file is harmless.
// Hashing ~200 PINs takes a while — hence the extended time limit.
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

  const cleaned: { full_name: string; email: string; pin: string }[] = [];
  const errors: string[] = [];
  rows.forEach((row: Record<string, unknown>, i: number) => {
    const fullName = typeof row?.full_name === "string" ? row.full_name.trim() : "";
    const email = typeof row?.email === "string" ? row.email.trim().toLowerCase() : "";
    const pin = typeof row?.pin === "string" ? row.pin.trim() : String(row?.pin ?? "");
    if (!fullName || !email.includes("@") || !/^\d{4}$/.test(pin)) {
      errors.push(`Row ${i + 1}: needs full_name, a valid email, and a 4-digit pin`);
      return;
    }
    cleaned.push({ full_name: fullName, email, pin });
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: "Some rows are invalid", details: errors }, { status: 400 });
  }

  // Duplicate emails inside the file itself — keep the first, skip the rest.
  const seen = new Set<string>();
  const unique = cleaned.filter((r) => {
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });

  const withHashes = [];
  for (const row of unique) {
    withHashes.push({
      full_name: row.full_name,
      email: row.email,
      pin_hash: await bcrypt.hash(row.pin, 10),
    });
  }

  const supabase = createServiceClient();
  // ignoreDuplicates leaves existing members untouched; select() gives
  // back only the rows actually inserted, which is our imported count.
  const { data: inserted, error } = await supabase
    .from("members")
    .upsert(withHashes, { onConflict: "email", ignoreDuplicates: true })
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Import failed while saving" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported: inserted?.length ?? 0,
    skippedAsDuplicates: rows.length - (inserted?.length ?? 0),
  });
}
