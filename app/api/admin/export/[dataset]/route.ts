import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// CSV downloads: /api/admin/export/books | members | loans.
// The library's data should never be locked in — these files open in
// Excel and double as a backup. PIN hashes are never exported.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toCsv(header: string[], rows: (string | number | boolean | null)[][]): string {
  const escape = (value: string | number | boolean | null): string => {
    const s = value === null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(escape).join(",")).join("\n") + "\n";
}

function csvResponse(filename: string, csv: string): NextResponse {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const { dataset } = await params;
  const supabase = createServiceClient();

  if (dataset === "books") {
    const { data, error } = await supabase
      .from("books")
      .select("title, author, stock_total, is_active")
      .order("title");
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
    return csvResponse(
      "books.csv",
      toCsv(
        ["title", "author", "stock_total", "active"],
        (data ?? []).map((b) => [b.title, b.author, b.stock_total, b.is_active ? "yes" : "no"])
      )
    );
  }

  if (dataset === "members") {
    const { data, error } = await supabase
      .from("members")
      .select("full_name, email, is_active, created_at")
      .order("full_name");
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
    return csvResponse(
      "members.csv",
      toCsv(
        ["full_name", "email", "active", "joined"],
        (data ?? []).map((m) => [m.full_name, m.email, m.is_active ? "yes" : "no", m.created_at])
      )
    );
  }

  if (dataset === "loans") {
    const { data, error } = await supabase
      .from("loans")
      .select("borrowed_at, due_at, returned_at, lost_at, members(full_name), books(title)")
      .order("borrowed_at", { ascending: false });
    if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 });
    const rows = (data ?? []).map((l) => {
      const member = Array.isArray(l.members) ? l.members[0] : l.members;
      const book = Array.isArray(l.books) ? l.books[0] : l.books;
      const status = l.lost_at ? "lost" : l.returned_at ? "returned" : "out";
      return [
        book?.title ?? "",
        member?.full_name ?? "",
        l.borrowed_at,
        l.due_at,
        l.returned_at,
        status,
      ];
    });
    return csvResponse(
      "loans.csv",
      toCsv(["book", "member", "borrowed_at", "due_at", "returned_at", "status"], rows)
    );
  }

  return NextResponse.json({ error: "Unknown export" }, { status: 404 });
}
