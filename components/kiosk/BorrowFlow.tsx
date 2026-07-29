"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PinPad from "./PinPad";
import { dueDateFromNow, formatFriendlyDate } from "@/lib/dates";

type Step = "member" | "pin" | "book" | "confirm" | "success";
type Member = { id: string; full_name: string };
type Book = { id: string; title: string; author: string; on_shelf: number };
type CheckoutResult = {
  bookTitle: string;
  memberName: string;
  dueAt: string;
  copiesLeft: number;
};

function firstName(fullName: string): string {
  return fullName.split(" ")[0];
}

export default function BorrowFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("member");

  const [members, setMembers] = useState<Member[] | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [member, setMember] = useState<Member | null>(null);

  // Kept in memory only while the flow is open; the server re-verifies
  // it on checkout so a forged request can't borrow as someone else.
  const [pin, setPin] = useState("");

  const [books, setBooks] = useState<Book[] | null>(null);
  const [bookSearch, setBookSearch] = useState("");
  const [book, setBook] = useState<Book | null>(null);
  const [previewDueAt, setPreviewDueAt] = useState("");

  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/kiosk/members", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setMembers(data.members))
      .catch(() => setLoadError("Couldn't load the member list. Is the database connected?"));
  }, []);

  // Fetches a fresh book list (so on-shelf counts are current) and
  // moves to the book step. Called on sign-in and "choose another".
  function goToBookStep() {
    setBooks(null);
    setStep("book");
    fetch("/api/kiosk/books", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setBooks(data.books))
      .catch(() => setLoadError("Couldn't load the book list."));
  }

  async function verifyPin(entered: string): Promise<string | null> {
    if (!member) return "Something went wrong — start again.";
    const res = await fetch("/api/kiosk/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, pin: entered }),
    });
    if (res.ok) {
      setPin(entered);
      goToBookStep();
      return null;
    }
    if (res.status === 423) {
      const data = await res.json().catch(() => null);
      const minutes = Math.max(1, Math.ceil((data?.retryAfterSeconds ?? 300) / 60));
      return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
    }
    return "That PIN isn't right — try again.";
  }

  async function confirmBorrow() {
    if (!member || !book || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    const res = await fetch("/api/kiosk/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, bookId: book.id, pin }),
    });
    setConfirming(false);
    if (res.ok) {
      setResult(await res.json());
      setStep("success");
      return;
    }
    if (res.status === 409) {
      setConfirmError("Sorry — the last copy has just gone out. Please choose another book.");
      return;
    }
    setConfirmError("Something went wrong saving the loan. Please try again.");
  }

  if (loadError) {
    return (
      <div className="kiosk-card">
        <h2>Hmm, that didn&apos;t work</h2>
        <p className="sub">{loadError}</p>
        <Link href="/" className="big-btn" style={{ marginTop: 24 }}>
          Back to start
        </Link>
      </div>
    );
  }

  if (step === "member") {
    const filtered = (members ?? []).filter((m) =>
      m.full_name.toLowerCase().includes(memberSearch.trim().toLowerCase())
    );
    return (
      <>
        <h1>Who&apos;s borrowing?</h1>
        <p className="lede">Find your name, then enter your PIN.</p>
        <input
          type="search"
          className="kiosk-search"
          placeholder="Search your name…"
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          autoFocus
        />
        <div className="kiosk-list">
          {members === null && <p className="sub list-note">Loading members…</p>}
          {members !== null && filtered.length === 0 && (
            <p className="sub list-note">No one found — try fewer letters.</p>
          )}
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              className="kiosk-row"
              onClick={() => {
                setMember(m);
                setStep("pin");
              }}
            >
              {m.full_name}
            </button>
          ))}
        </div>
      </>
    );
  }

  if (step === "pin" && member) {
    return (
      <>
        <h1>Hi, {firstName(member.full_name)}</h1>
        <p className="lede">Enter your 4-digit PIN.</p>
        <PinPad onSubmit={verifyPin} />
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMember(null);
            setStep("member");
          }}
        >
          Not you? Go back
        </button>
      </>
    );
  }

  if (step === "book") {
    const filtered = (books ?? []).filter((b) =>
      (b.title + " " + b.author).toLowerCase().includes(bookSearch.trim().toLowerCase())
    );
    return (
      <>
        <h1>Choose a book</h1>
        <p className="lede">Only books on the shelf can be borrowed.</p>
        <input
          type="search"
          className="kiosk-search"
          placeholder="Search title or author…"
          value={bookSearch}
          onChange={(e) => setBookSearch(e.target.value)}
        />
        <div className="kiosk-list">
          {books === null && <p className="sub list-note">Loading books…</p>}
          {books !== null && filtered.length === 0 && (
            <p className="sub list-note">No books match that search.</p>
          )}
          {filtered.map((b) => (
            <button
              key={b.id}
              type="button"
              className="kiosk-row book-row"
              disabled={b.on_shelf <= 0}
              onClick={() => {
                setBook(b);
                setPreviewDueAt(formatFriendlyDate(dueDateFromNow().toISOString()));
                setConfirmError(null);
                setStep("confirm");
              }}
            >
              <span className="book-title">
                {b.title}
                <span className="sub"> · {b.author}</span>
              </span>
              {b.on_shelf > 0 ? (
                <span className="badge ok">On shelf · {b.on_shelf}</span>
              ) : (
                <span className="badge out">All out</span>
              )}
            </button>
          ))}
        </div>
      </>
    );
  }

  if (step === "confirm" && member && book) {
    return (
      <>
        <h1>Ready to borrow?</h1>
        <div className="kiosk-card confirm-card">
          <p className="confirm-book">{book.title}</p>
          <p className="sub">{book.author}</p>
          <div className="confirm-facts">
            <div className="row">
              <span className="sub">Borrower</span>
              <span>{member.full_name}</span>
            </div>
            <div className="row">
              <span className="sub">Return by</span>
              <span>{previewDueAt}</span>
            </div>
            <div className="row">
              <span className="sub">Copies left after this</span>
              <span>{book.on_shelf - 1}</span>
            </div>
          </div>
          {confirmError && <p className="confirm-error">{confirmError}</p>}
          <button
            type="button"
            className="big-btn primary"
            onClick={confirmBorrow}
            disabled={confirming}
          >
            {confirming ? "One moment…" : "Confirm — borrow this book"}
          </button>
          <button type="button" className="link-btn" onClick={goToBookStep}>
            Choose a different book
          </button>
        </div>
      </>
    );
  }

  if (step === "success" && result) {
    return (
      <div className="kiosk-card success-card">
        <div className="success-mark">✓</div>
        <h1>Enjoy the read!</h1>
        <p className="lede">
          {result.bookTitle} is yours until {formatFriendlyDate(result.dueAt)}.
        </p>
        <button type="button" className="big-btn primary" onClick={() => router.push("/")}>
          Done
        </button>
      </div>
    );
  }

  return null;
}
