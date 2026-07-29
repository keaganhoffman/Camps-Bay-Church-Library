import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendDueSoonEmail, sendOverdueEmail } from "@/lib/email/loan-emails";
import { firstName } from "@/lib/names";
import { startOfTodaySAST } from "@/lib/dates";

// The daily reminder job (Phase 5). Vercel Cron calls this every day
// at 06:00 UTC (08:00 SAST) — see vercel.json.
//
// Rules from the brief, enforced via email_log:
//   due_soon — once per loan EVER, sent when due_at is within 3 days
//   overdue  — once per loan PER SAST CALENDAR DAY once due_at passed,
//              capped at 14 sends total (after two weeks of reminders
//              the book is a job for the librarian, not the inbox —
//              see "mark as lost" in Admin -> Loans)
//
// Protected by CRON_SECRET: Vercel's scheduler sends it as a Bearer
// header automatically; ?key=... lets the owner trigger a run from a
// browser for testing.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DUE_SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_OVERDUE_EMAILS_PER_LOAN = 14;

function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // no secret configured = nobody gets in
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("key") === secret;
}

type LoanToRemind = {
  id: string;
  due_at: string;
  email: string;
  full_name: string;
  title: string;
};

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const dueSoonCutoff = new Date(now.getTime() + DUE_SOON_WINDOW_MS);

  // Every open loan already due or due within the next 3 days,
  // with borrower and book attached.
  const { data, error } = await supabase
    .from("loans")
    .select("id, due_at, members(email, full_name, is_active), books(title)")
    .is("returned_at", null)
    .lte("due_at", dueSoonCutoff.toISOString());

  if (error) {
    return NextResponse.json({ error: "Couldn't load loans" }, { status: 500 });
  }

  const loans: LoanToRemind[] = (data ?? []).flatMap((row) => {
    const member = Array.isArray(row.members) ? row.members[0] : row.members;
    const book = Array.isArray(row.books) ? row.books[0] : row.books;
    if (!member?.is_active || !member.email || !book) return []; // skip deactivated members
    return [
      {
        id: row.id,
        due_at: row.due_at,
        email: member.email,
        full_name: member.full_name,
        title: book.title,
      },
    ];
  });

  const dueSoon = loans.filter((l) => new Date(l.due_at) > now);
  const overdue = loans.filter((l) => new Date(l.due_at) <= now);

  // What has already been sent? One email_log query covers all rules.
  const alreadyDueSoon = new Set<string>();
  const alreadyOverdueToday = new Set<string>();
  const overdueSendCount = new Map<string, number>();
  if (loans.length > 0) {
    const { data: logRows, error: logError } = await supabase
      .from("email_log")
      .select("loan_id, type, sent_at")
      .in("loan_id", loans.map((l) => l.id))
      .in("type", ["due_soon", "overdue"]);

    if (logError) {
      // Without the log we can't guarantee no double-sends — stop.
      return NextResponse.json({ error: "Couldn't check email log" }, { status: 500 });
    }

    const todayStart = startOfTodaySAST(now);
    for (const row of logRows ?? []) {
      if (row.type === "due_soon") {
        alreadyDueSoon.add(row.loan_id);
      } else if (row.type === "overdue") {
        overdueSendCount.set(row.loan_id, (overdueSendCount.get(row.loan_id) ?? 0) + 1);
        if (new Date(row.sent_at) >= todayStart) {
          alreadyOverdueToday.add(row.loan_id);
        }
      }
    }
  }

  let dueSoonSent = 0;
  let overdueSent = 0;

  for (const loan of dueSoon) {
    if (alreadyDueSoon.has(loan.id)) continue;
    const sent = await sendDueSoonEmail(supabase, {
      loanId: loan.id,
      to: loan.email,
      firstName: firstName(loan.full_name),
      bookTitle: loan.title,
      dueAtIso: loan.due_at,
    });
    if (sent) dueSoonSent++;
  }

  let capped = 0;
  for (const loan of overdue) {
    if ((overdueSendCount.get(loan.id) ?? 0) >= MAX_OVERDUE_EMAILS_PER_LOAN) {
      capped++;
      continue;
    }
    if (alreadyOverdueToday.has(loan.id)) continue;
    const sent = await sendOverdueEmail(supabase, {
      loanId: loan.id,
      to: loan.email,
      firstName: firstName(loan.full_name),
      bookTitle: loan.title,
      dueAtIso: loan.due_at,
    });
    if (sent) overdueSent++;
  }

  // The summary the owner sees when triggering a test run.
  return NextResponse.json({
    ranAt: now.toISOString(),
    openLoansChecked: loans.length,
    dueSoon: { found: dueSoon.length, sent: dueSoonSent, alreadySent: alreadyDueSoon.size },
    overdue: {
      found: overdue.length,
      sent: overdueSent,
      alreadySentToday: alreadyOverdueToday.size,
      cappedAfter14: capped,
    },
  });
}
