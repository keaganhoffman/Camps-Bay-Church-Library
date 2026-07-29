"use client";

import { useEffect, useState } from "react";

type Report = {
  stats: {
    activeMembers: number;
    titles: number;
    copies: number;
    openLoans: number;
    overdue: number;
    totalBorrowsAllTime: number;
    lostBooks: number;
  };
  mostBorrowed: { title: string; author: string; borrows: number }[];
  neverBorrowed: { title: string; author: string }[];
  months: { label: string; borrows: number }[];
};

export default function ReportsAdmin() {
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/reports", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setReport)
      .catch(() => setMessage("Couldn't load the reports."));
  }, []);

  if (message) return <p className="admin-message">{message}</p>;
  if (!report) return <p className="sub">Crunching the numbers…</p>;

  const { stats } = report;
  const tiles = [
    { label: "Books out now", value: stats.openLoans },
    { label: "Overdue", value: stats.overdue },
    { label: "Active members", value: stats.activeMembers },
    { label: "Titles", value: stats.titles },
    { label: "Copies owned", value: stats.copies },
    { label: "Borrows all-time", value: stats.totalBorrowsAllTime },
    { label: "Books lost", value: stats.lostBooks },
  ];

  return (
    <>
      <h1>Reports</h1>
      <p className="lede">How the library is doing, straight from the loan records.</p>

      <div className="stat-tiles">
        {tiles.map((t) => (
          <div className="stat-tile" key={t.label}>
            <div className="stat-value">{t.value}</div>
            <div className="stat-label">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Most borrowed</h2>
        {report.mostBorrowed.length === 0 && (
          <p className="sub">No borrows recorded yet.</p>
        )}
        {report.mostBorrowed.map((b, i) => (
          <div className="row" key={b.title + b.author}>
            <span>
              <span className="sub">{i + 1}. </span>
              {b.title}
              <span className="sub"> · {b.author}</span>
            </span>
            <span className="badge accent">
              {b.borrows} borrow{b.borrows === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Borrows by month</h2>
        {report.months.map((m) => (
          <div className="row" key={m.label}>
            <span className="sub">{m.label}</span>
            <span>{m.borrows}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Never borrowed</h2>
        <p className="sub">
          Candidates for the retirement shelf — {report.neverBorrowed.length} title
          {report.neverBorrowed.length === 1 ? "" : "s"}.
        </p>
        {report.neverBorrowed.slice(0, 30).map((b) => (
          <div className="row" key={b.title + b.author}>
            <span>
              {b.title}
              <span className="sub"> · {b.author}</span>
            </span>
          </div>
        ))}
        {report.neverBorrowed.length > 30 && (
          <p className="sub" style={{ marginTop: 8 }}>
            …and {report.neverBorrowed.length - 30} more (see the books export below).
          </p>
        )}
      </div>

      <div className="card">
        <h2>Download your data</h2>
        <p className="sub">
          Spreadsheet copies of everything — useful as a monthly backup. PINs are never
          included.
        </p>
        {/* Plain <a> on purpose: these are file downloads served with a
            Content-Disposition header, not page navigations. */}
        <div className="admin-form-row" style={{ marginTop: 12 }}>
          <a className="btn ghost" href="/api/admin/export/books" download>
            Books.csv
          </a>
          <a className="btn ghost" href="/api/admin/export/members" download>
            Members.csv
          </a>
          <a className="btn ghost" href="/api/admin/export/loans" download>
            Loans.csv
          </a>
        </div>
      </div>
    </>
  );
}
