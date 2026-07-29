"use client";

import { useEffect, useState } from "react";
import { daysLate, formatShortDate } from "@/lib/dates";

type AdminLoan = {
  id: string;
  member_name: string;
  book_title: string;
  badge: { label: string; late: boolean };
};

export default function LoansAdmin() {
  const [loans, setLoans] = useState<AdminLoan[] | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/loans", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const withBadges = (
          data.loans as { id: string; member_name: string; book_title: string; due_at: string }[]
        ).map((l) => {
          const late = daysLate(l.due_at);
          return {
            id: l.id,
            member_name: l.member_name,
            book_title: l.book_title,
            badge:
              late > 0
                ? { label: `${late} day${late === 1 ? "" : "s"} late`, late: true }
                : { label: `Due ${formatShortDate(l.due_at)}`, late: false },
          };
        });
        setLoans(withBadges);
      })
      .catch(() => setMessage("Couldn't load loans."));
  }

  useEffect(load, []);

  async function markReturned(loan: AdminLoan) {
    if (!window.confirm(`Mark "${loan.book_title}" (${loan.member_name}) as returned?`)) return;
    const res = await fetch(`/api/admin/loans/${loan.id}/return`, { method: "POST" });
    if (res.ok) {
      load();
    } else {
      setMessage("Couldn't mark it returned — refresh and try again.");
    }
  }

  async function markLost(loan: AdminLoan) {
    const sure = window.confirm(
      `Mark "${loan.book_title}" (${loan.member_name}) as LOST?\n\n` +
        "This closes the loan, reduces the book's stock by one, and stops the overdue emails."
    );
    if (!sure) return;
    const res = await fetch(`/api/admin/loans/${loan.id}/lost`, { method: "POST" });
    if (res.ok) {
      load();
    } else {
      setMessage("Couldn't mark it lost — refresh and try again.");
    }
  }

  const shown = (loans ?? []).filter((l) => !overdueOnly || l.badge.late);
  const overdueCount = (loans ?? []).filter((l) => l.badge.late).length;

  return (
    <>
      <h1>Loans</h1>
      <p className="lede">
        Every book currently out{loans ? ` — ${loans.length} open, ${overdueCount} overdue` : ""}.
      </p>

      <label className="admin-filter">
        <input
          type="checkbox"
          checked={overdueOnly}
          onChange={(e) => setOverdueOnly(e.target.checked)}
        />
        Show overdue only
      </label>

      {message && <p className="admin-message">{message}</p>}

      <div className="kiosk-list">
        {loans === null && <p className="sub list-note">Loading…</p>}
        {loans !== null && shown.length === 0 && (
          <p className="sub list-note">
            {overdueOnly ? "Nothing overdue — well done, everyone." : "No books are out right now."}
          </p>
        )}
        {shown.map((l) => (
          <div className="admin-row" key={l.id}>
            <span className="grow">
              {l.book_title}
              <span className="sub"> · {l.member_name}</span>
            </span>
            <span className={`badge ${l.badge.late ? "error" : "accent"}`}>{l.badge.label}</span>
            <button type="button" className="btn ghost" onClick={() => markReturned(l)}>
              Mark returned
            </button>
            {l.badge.late && (
              <button type="button" className="btn ghost danger" onClick={() => markLost(l)}>
                Mark lost
              </button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
