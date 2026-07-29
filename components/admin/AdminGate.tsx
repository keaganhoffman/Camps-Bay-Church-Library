"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PinPad from "@/components/kiosk/PinPad";

// Wraps every admin page: shows the 6-digit PIN screen until the
// browser has a valid admin session cookie, then the admin nav +
// the page itself.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");

  useEffect(() => {
    fetch("/api/admin/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { ok: false }))
      .then((data) => setState(data.ok ? "open" : "locked"))
      .catch(() => setState("locked"));
  }, []);

  async function submitPin(pin: string): Promise<string | null> {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setState("open");
      return null;
    }
    if (res.status === 423) {
      const data = await res.json().catch(() => null);
      const minutes = Math.max(1, Math.ceil((data?.retryAfterSeconds ?? 300) / 60));
      return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
    }
    return "That's not the admin PIN — try again.";
  }

  async function exitAdmin() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.replace("/");
  }

  if (state === "checking") {
    return <p className="sub">One moment…</p>;
  }

  if (state === "locked") {
    return (
      <>
        <h1>Admin</h1>
        <p className="lede">Enter the 6-digit admin PIN.</p>
        <PinPad length={6} onSubmit={submitPin} />
        <Link href="/" className="link-btn">
          Back to the library
        </Link>
      </>
    );
  }

  return (
    <>
      <nav className="admin-nav">
        <Link href="/admin">Admin</Link>
        <Link href="/admin/books">Books</Link>
        <Link href="/admin/members">Members</Link>
        <Link href="/admin/loans">Loans</Link>
        <button type="button" className="admin-exit" onClick={exitAdmin}>
          Exit admin
        </button>
      </nav>
      {children}
    </>
  );
}
