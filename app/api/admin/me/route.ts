import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/session";

// Lets the admin UI ask "is this browser signed in?"
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json({ ok: isAdminRequest(request) });
}
