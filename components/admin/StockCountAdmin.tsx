"use client";

import { useEffect, useState } from "react";
import { formatFriendlyDate } from "@/lib/dates";

type CountBook = {
  id: string;
  title: string;
  author: string;
  is_active: boolean;
  expected: number;
  actual: string; // input value; parsed on review
};

type PastCount = {
  id: string;
  counted_at: string;
  counted_by: string;
  booksCounted: number;
  discrepancies: number;
};

type PastLine = {
  id: string;
  title: string;
  author: string;
  expected: number;
  actual: number;
  adjustment: number;
};

type View = "home" | "counting" | "review" | "done" | "past";

export default function StockCountAdmin() {
  const [view, setView] = useState<View>("home");
  const [message, setMessage] = useState<string | null>(null);

  const [countedBy, setCountedBy] = useState("");
  const [books, setBooks] = useState<CountBook[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [doneSummary, setDoneSummary] = useState<{ books: number; adjustments: number } | null>(
    null
  );

  const [pastCounts, setPastCounts] = useState<PastCount[] | null>(null);
  const [pastDetail, setPastDetail] = useState<{
    heading: string;
    lines: PastLine[];
  } | null>(null);

  function loadPastCounts() {
    fetch("/api/admin/stock-counts", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setPastCounts(data.counts))
      .catch(() => setMessage("Couldn't load past counts."));
  }

  useEffect(loadPastCounts, []);

  async function startCount(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const res = await fetch("/api/admin/books", { cache: "no-store" });
    if (!res.ok) {
      setMessage("Couldn't load the book list — try again.");
      return;
    }
    const data = await res.json();
    setBooks(
      (
        data.books as {
          id: string;
          title: string;
          author: string;
          on_shelf: number;
          is_active: boolean;
        }[]
      ).map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        is_active: b.is_active,
        expected: b.on_shelf,
        actual: String(b.on_shelf), // pre-filled; change only what differs
      }))
    );
    setSearch("");
    setView("counting");
  }

  function setActual(id: string, value: string) {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, actual: value } : b)));
  }

  function discrepancies(): CountBook[] {
    return books.filter((b) => Number(b.actual) !== b.expected);
  }

  function invalidEntries(): CountBook[] {
    return books.filter((b) => {
      const n = Number(b.actual);
      return b.actual.trim() === "" || !Number.isInteger(n) || n < 0;
    });
  }

  async function confirmCount() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/stock-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counted_by: countedBy,
        lines: books.map((b) => ({
          book_id: b.id,
          expected_on_shelf: b.expected,
          actual_on_shelf: Number(b.actual),
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Couldn't save the count — try again.");
      return;
    }
    const data = await res.json();
    setDoneSummary({ books: data.booksCounted, adjustments: data.adjustmentsApplied });
    setCountedBy("");
    setView("done");
    loadPastCounts();
  }

  async function openPastCount(id: string) {
    setMessage(null);
    const res = await fetch(`/api/admin/stock-counts/${id}`, { cache: "no-store" });
    if (!res.ok) {
      setMessage("Couldn't open that count.");
      return;
    }
    const data = await res.json();
    setPastDetail({
      heading: `${formatFriendlyDate(data.count.counted_at)} — counted by ${data.count.counted_by}`,
      lines: data.lines,
    });
    setView("past");
  }

  // ---------- views ----------

  if (view === "counting") {
    const shown = books.filter((b) =>
      (b.title + " " + b.author).toLowerCase().includes(search.trim().toLowerCase())
    );
    const diffs = discrepancies().length;
    const invalid = invalidEntries().length;
    return (
      <>
        <h1>Counting the shelves</h1>
        <p className="lede">
          For each book, enter how many copies are physically on the shelf. The number is
          pre-filled with what the system expects — only change the ones that differ.
        </p>
        <input
          type="search"
          className="kiosk-search"
          placeholder="Search books…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="kiosk-list">
          {shown.map((b) => (
            <div className="admin-row" key={b.id}>
              <span className="grow">
                {b.title}
                <span className="sub"> · {b.author}</span>
                {!b.is_active && <span className="badge out"> Hidden</span>}
              </span>
              <span className="sub">expected {b.expected}</span>
              <input
                className="admin-input stock"
                type="number"
                min={0}
                inputMode="numeric"
                value={b.actual}
                onChange={(e) => setActual(b.id, e.target.value)}
              />
            </div>
          ))}
        </div>
        {message && <p className="admin-message">{message}</p>}
        <div className="admin-form-row" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="btn"
            disabled={invalid > 0}
            onClick={() => setView("review")}
          >
            {invalid > 0
              ? `${invalid} entr${invalid === 1 ? "y" : "ies"} need a number`
              : `Review${diffs > 0 ? ` ${diffs} discrepanc${diffs === 1 ? "y" : "ies"}` : ""}`}
          </button>
          <button type="button" className="btn ghost" onClick={() => setView("home")}>
            Cancel count
          </button>
        </div>
      </>
    );
  }

  if (view === "review") {
    const diffs = discrepancies();
    return (
      <>
        <h1>Review the count</h1>
        {diffs.length === 0 ? (
          <p className="lede">Every shelf matches the system — nothing to adjust.</p>
        ) : (
          <>
            <p className="lede">
              {diffs.length} book{diffs.length === 1 ? "" : "s"} differ from what the system
              expected. Confirming applies these stock adjustments:
            </p>
            <div className="kiosk-list">
              {diffs.map((b) => {
                const delta = Number(b.actual) - b.expected;
                return (
                  <div className="admin-row" key={b.id}>
                    <span className="grow">
                      {b.title}
                      <span className="sub"> · {b.author}</span>
                    </span>
                    <span className="sub">
                      expected {b.expected}, counted {Number(b.actual)}
                    </span>
                    <span className={`badge ${delta < 0 ? "error" : "ok"}`}>
                      {delta > 0 ? `+${delta}` : delta} cop{Math.abs(delta) === 1 ? "y" : "ies"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {message && <p className="admin-message">{message}</p>}
        <div className="admin-form-row" style={{ marginTop: 20 }}>
          <button type="button" className="btn" onClick={confirmCount} disabled={saving}>
            {saving
              ? "Saving…"
              : diffs.length === 0
                ? "Confirm — record the count"
                : "Confirm — record count and adjust stock"}
          </button>
          <button type="button" className="btn ghost" onClick={() => setView("counting")}>
            Back to counting
          </button>
        </div>
      </>
    );
  }

  if (view === "done" && doneSummary) {
    return (
      <div className="kiosk-card success-card">
        <div className="success-mark">✓</div>
        <h1>Count recorded</h1>
        <p className="lede">
          {doneSummary.books} books counted
          {doneSummary.adjustments > 0
            ? `, ${doneSummary.adjustments} stock adjustment${
                doneSummary.adjustments === 1 ? "" : "s"
              } applied.`
            : " — everything matched."}
        </p>
        <button type="button" className="big-btn primary" onClick={() => setView("home")}>
          Done
        </button>
      </div>
    );
  }

  if (view === "past" && pastDetail) {
    return (
      <>
        <h1>Stock count</h1>
        <p className="lede">{pastDetail.heading}</p>
        <div className="kiosk-list">
          {pastDetail.lines.map((l) => (
            <div className="admin-row" key={l.id}>
              <span className="grow">
                {l.title}
                <span className="sub"> · {l.author}</span>
              </span>
              <span className="sub">
                expected {l.expected}, counted {l.actual}
              </span>
              {l.adjustment !== 0 ? (
                <span className={`badge ${l.adjustment < 0 ? "error" : "ok"}`}>
                  {l.adjustment > 0 ? `+${l.adjustment}` : l.adjustment}
                </span>
              ) : (
                <span className="badge accent">match</span>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setPastDetail(null);
            setView("home");
          }}
        >
          Back to stock counts
        </button>
      </>
    );
  }

  // home
  return (
    <>
      <h1>Stock count</h1>
      <p className="lede">
        A monthly walk of the shelves to check the books really there match the system.
      </p>

      <form className="card admin-form" onSubmit={startCount}>
        <h2>Start a new count</h2>
        <div className="admin-form-row">
          <input
            className="admin-input grow"
            placeholder="Who's counting? (your name)"
            value={countedBy}
            onChange={(e) => setCountedBy(e.target.value)}
            required
          />
          <button type="submit" className="btn">
            Start counting
          </button>
        </div>
      </form>

      {message && <p className="admin-message">{message}</p>}

      <h2 style={{ marginTop: 32, fontSize: 22 }}>Past counts</h2>
      <div className="kiosk-list" style={{ marginTop: 12 }}>
        {pastCounts === null && <p className="sub list-note">Loading…</p>}
        {pastCounts !== null && pastCounts.length === 0 && (
          <p className="sub list-note">No counts yet — the first one starts above.</p>
        )}
        {(pastCounts ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            className="kiosk-row book-row"
            onClick={() => openPastCount(c.id)}
          >
            <span className="book-title">
              {formatFriendlyDate(c.counted_at)}
              <span className="sub"> · {c.counted_by}</span>
            </span>
            <span className={`badge ${c.discrepancies > 0 ? "error" : "ok"}`}>
              {c.discrepancies > 0
                ? `${c.discrepancies} discrepanc${c.discrepancies === 1 ? "y" : "ies"}`
                : "all matched"}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
