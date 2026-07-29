import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/session";

// The numbers behind the library: headline stats, most-borrowed
// titles, never-borrowed titles, and borrows per month. All derived
// from the loans table — at this scale (a few thousand loans a year)
// fetching and aggregating in one pass is simplest and plenty fast.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const [booksRes, loansRes, membersRes] = await Promise.all([
    supabase.from("books").select("id, title, author, stock_total, is_active"),
    supabase.from("loans").select("id, book_id, borrowed_at, due_at, returned_at, lost_at"),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  if (booksRes.error || loansRes.error) {
    return NextResponse.json({ error: "Couldn't load report data" }, { status: 500 });
  }

  const books = booksRes.data ?? [];
  const loans = loansRes.data ?? [];
  const now = new Date();

  const openLoans = loans.filter((l) => l.returned_at === null);
  const overdue = openLoans.filter((l) => new Date(l.due_at) < now);
  const lost = loans.filter((l) => l.lost_at !== null);

  // Borrow counts per book, all time.
  const borrowCount = new Map<string, number>();
  for (const loan of loans) {
    borrowCount.set(loan.book_id, (borrowCount.get(loan.book_id) ?? 0) + 1);
  }

  const mostBorrowed = books
    .map((b) => ({ title: b.title, author: b.author, borrows: borrowCount.get(b.id) ?? 0 }))
    .filter((b) => b.borrows > 0)
    .sort((a, b) => b.borrows - a.borrows)
    .slice(0, 10);

  const neverBorrowed = books
    .filter((b) => b.is_active && !borrowCount.has(b.id))
    .map((b) => ({ title: b.title, author: b.author }))
    .sort((a, b) => a.title.localeCompare(b.title));

  // Borrows per month, last 12 months, in SAST-friendly labels.
  const monthFormat = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    month: "short",
    year: "numeric",
  });
  const months: { label: string; borrows: number }[] = [];
  for (let back = 11; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 15);
    months.push({ label: monthFormat.format(d), borrows: 0 });
  }
  const labelIndex = new Map(months.map((m, i) => [m.label, i]));
  for (const loan of loans) {
    const label = monthFormat.format(new Date(loan.borrowed_at));
    const idx = labelIndex.get(label);
    if (idx !== undefined) months[idx].borrows++;
  }

  return NextResponse.json({
    stats: {
      activeMembers: membersRes.count ?? 0,
      titles: books.filter((b) => b.is_active).length,
      copies: books.filter((b) => b.is_active).reduce((sum, b) => sum + b.stock_total, 0),
      openLoans: openLoans.length,
      overdue: overdue.length,
      totalBorrowsAllTime: loans.length,
      lostBooks: lost.length,
    },
    mostBorrowed,
    neverBorrowed,
    months,
  });
}
