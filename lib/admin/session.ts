// Admin sessions, without a sessions table.
//
// After a correct admin PIN, the browser gets an HTTP-only cookie
// containing an expiry timestamp plus an HMAC signature of it. Only
// the server can mint a valid signature (the signing key never leaves
// the server), so the cookie can't be forged or extended — and being
// HTTP-only, page JavaScript can't even read it.
import "server-only";
import crypto from "crypto";

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_SESSION_SECONDS = 60 * 60; // 1 hour, then re-enter the PIN

function signingKey(): string {
  // Already secret, always present when the app works at all.
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", signingKey()).update(value).digest("hex");
}

export function mintAdminCookieValue(): string {
  const expiresAt = String(Date.now() + ADMIN_SESSION_SECONDS * 1000);
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function isAdminRequest(request: Request): boolean {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return false;

  const [expiresAt, signature] = match[1].split(".");
  if (!expiresAt || !signature) return false;

  const expected = sign(expiresAt);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  return Number(expiresAt) > Date.now();
}
