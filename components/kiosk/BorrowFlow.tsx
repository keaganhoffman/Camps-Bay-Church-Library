"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MemberSignIn, { type Member } from "./MemberSignIn";
import { dueDateFromNow, formatFriendlyDate } from "@/lib/dates";

type Step = "signin" | "book" | "confirm" | "success";
type Book = { id: string; title: string; author: string; on_shelf: number };
type CheckoutResult = {
  bookTitle: string;
  memberName: string;
  dueAt: string;
  copiesLeft: number;
};

export default function BorrowFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("signin");
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

  if (step === "signin") {
    return (
      <MemberSignIn
        heading="Who's borrowing?"
        onSignedIn={(m, enteredPin) => {
          setMember(m);
          setPin(enteredPin);
          goToBookStep();
        }}
      />
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
