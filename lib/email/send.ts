import "server-only";
import { Resend } from "resend";

// Until a domain is verified in Resend (Phase 8), the free sandbox
// sender only delivers to the email address that owns the Resend
// account — fine for testing.
const DEFAULT_FROM = "Christian Life Camps Bay Library <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sends one email. Returns true if Resend accepted it.
 * Never throws — a broken email service must never stop a member
 * borrowing or returning a book.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(`Email not configured (RESEND_API_KEY missing) — skipped "${options.subject}"`);
    return false;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
    });
    if (error) {
      console.error(`Resend rejected "${options.subject}" to ${options.to}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Sending "${options.subject}" to ${options.to} failed:`, err);
    return false;
  }
}
