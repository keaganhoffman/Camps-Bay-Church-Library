import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./send";
import { formatFriendlyDate } from "@/lib/dates";

// The two "live action" emails (Phase 4). The cron emails — due_soon
// and overdue — arrive in Phase 5 and will reuse this same pattern.
//
// Tone per the brief: warm, short, plain. No marketing voice.

async function logEmail(supabase: SupabaseClient, loanId: string, type: string) {
  const { error } = await supabase.from("email_log").insert({ loan_id: loanId, type });
  if (error) console.error(`Couldn't log ${type} email for loan ${loanId}:`, error.message);
}

export async function sendReceiptEmail(
  supabase: SupabaseClient,
  loan: {
    loanId: string;
    to: string;
    firstName: string;
    bookTitle: string;
    bookAuthor: string;
    dueAtIso: string;
  }
): Promise<void> {
  const dueDate = formatFriendlyDate(loan.dueAtIso);
  const sent = await sendEmail({
    to: loan.to,
    subject: `Your book: ${loan.bookTitle}`,
    text: [
      `Hi ${loan.firstName},`,
      ``,
      `You've borrowed ${loan.bookTitle} by ${loan.bookAuthor} from the church library.`,
      ``,
      `Please bring it back by ${dueDate}.`,
      ``,
      `Enjoy the read!`,
      ``,
      `Christian Life Camps Bay Library`,
    ].join("\n"),
  });
  if (sent) await logEmail(supabase, loan.loanId, "receipt");
}

export async function sendThankYouEmail(
  supabase: SupabaseClient,
  loan: {
    loanId: string;
    to: string;
    firstName: string;
    bookTitle: string;
  }
): Promise<void> {
  const sent = await sendEmail({
    to: loan.to,
    subject: `Thanks for returning ${loan.bookTitle}`,
    text: [
      `Hi ${loan.firstName},`,
      ``,
      `Thanks for bringing back ${loan.bookTitle} — it's on the shelf and ready for the next reader.`,
      ``,
      `See you at the library soon.`,
      ``,
      `Christian Life Camps Bay Library`,
    ].join("\n"),
  });
  if (sent) await logEmail(supabase, loan.loanId, "thank_you");
}
