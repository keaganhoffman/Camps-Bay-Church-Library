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

export async function sendDueSoonEmail(
  supabase: SupabaseClient,
  loan: {
    loanId: string;
    to: string;
    firstName: string;
    bookTitle: string;
    dueAtIso: string;
  }
): Promise<boolean> {
  const dueDate = formatFriendlyDate(loan.dueAtIso);
  const sent = await sendEmail({
    to: loan.to,
    subject: `A gentle reminder: ${loan.bookTitle} is due soon`,
    text: [
      `Hi ${loan.firstName},`,
      ``,
      `Just a friendly reminder that ${loan.bookTitle} is due back at the library by ${dueDate}.`,
      ``,
      `No rush if you're mid-chapter — just bring it along when it's due.`,
      ``,
      `Christian Life Camps Bay Library`,
    ].join("\n"),
  });
  if (sent) await logEmail(supabase, loan.loanId, "due_soon");
  return sent;
}

export async function sendOverdueEmail(
  supabase: SupabaseClient,
  loan: {
    loanId: string;
    to: string;
    firstName: string;
    bookTitle: string;
    dueAtIso: string;
  }
): Promise<boolean> {
  const dueDate = formatFriendlyDate(loan.dueAtIso);
  const sent = await sendEmail({
    to: loan.to,
    subject: `${loan.bookTitle} is overdue`,
    text: [
      `Hi ${loan.firstName},`,
      ``,
      `${loan.bookTitle} was due back on ${dueDate}. Please bring it in next time you're at church — the next reader will be glad to see it.`,
      ``,
      `Thank you!`,
      ``,
      `Christian Life Camps Bay Library`,
    ].join("\n"),
  });
  if (sent) await logEmail(supabase, loan.loanId, "overdue");
  return sent;
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
