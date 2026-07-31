"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MemberSignIn, { type Member } from "./MemberSignIn";
import AutoHome from "./AutoHome";
import BarcodeScanner from "./BarcodeScanner";
import { firstName } from "@/lib/names";
import { daysLate, formatShortDate } from "@/lib/dates";

type Step = "signin" | "loans" | "confirm" | "success";

// Badge text/colour is worked out once, when the loans arrive.
type Loan = {
  id: string;
  title: string;
  author: string;
  barcode: string | null;
  badge: { label: string; late: boolean };
};

type ReturnResult = { bookTitle: string; remainingLoans: number };

export default function ReturnFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("signin");
  const [member, setMember] = useState<Member | null>(null);
  const [pin, setPin] = useState("");

  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);

  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ReturnResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [scanKey, setScanKey] = useState(0);
  const [scanDone, setScanDone] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  function signedIn(m: Member, enteredPin: string) {
    setMember(m);
    setPin(enteredPin);
    setStep("loans");
    fetch("/api/kiosk/my-loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: m.id, pin: enteredPin }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const withBadges = (
          data.loans as {
            id: string;
            title: string;
            author: string;
            barcode: string | null;
            due_at: string;
          }[]
        ).map((l) => {
          const late = daysLate(l.due_at);
          return {
            id: l.id,
            title: l.title,
            author: l.author,
            barcode: l.barcode,
            badge:
              late > 0
                ? { label: `${late} day${late === 1 ? "" : "s"} late`, late: true }
                : { label: `Due ${formatShortDate(l.due_at)}`, late: false },
          };
        });
        setLoans(withBadges);
      })
      .catch(() => setLoadError("Couldn't load your loans. Please try again."));
  }

  function chooseLoan(l: Loan) {
    setLoan(l);
    setConfirmError(null);
    setStep("confirm");
  }

  function handleScan(code: string) {
    setScanDone(true);
    const match = (loans ?? []).find((l) => l.barcode === code);
    if (!match) {
      setScanMessage(
        "That barcode doesn't match any of your books — tap it in the list below, or scan again."
      );
      return;
    }
    chooseLoan(match);
  }

  async function confirmReturn() {
    if (!member || !loan || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    const res = await fetch("/api/kiosk/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, loanId: loan.id, pin }),
    });
    setConfirming(false);
    if (res.ok) {
      setResult(await res.json());
      setStep("success");
      return;
    }
    setConfirmError("Something went wrong saving the return. Please try again.");
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
    return <MemberSignIn heading="Who's returning?" onSignedIn={signedIn} />;
  }

  if (step === "loans" && member) {
    return (
      <>
        <Link href="/" className="back-btn">
          <span className="chevron">‹</span> Back
        </Link>
        <h1>Welcome back, {firstName(member.full_name)}</h1>
        <p className="lede">Scan the book you&apos;re returning, or tap it in the list.</p>

        {loans !== null && loans.length > 0 && (
          <div className="kiosk-card scan-card">
            {!scanDone && <BarcodeScanner key={scanKey} onDetected={handleScan} />}
            {scanMessage && <p className="scan-message">{scanMessage}</p>}
            {scanDone && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setScanDone(false);
                  setScanMessage(null);
                  setScanKey((k) => k + 1);
                }}
              >
                Scan again
              </button>
            )}
          </div>
        )}

        <div className="kiosk-list" style={{ marginTop: 16 }}>
          {loans === null && <p className="sub list-note">Loading your books…</p>}
          {loans !== null && loans.length === 0 && (
            <p className="sub list-note">
              You have no books out — you&apos;re all square!
            </p>
          )}
          {(loans ?? []).map((l) => (
            <button
              key={l.id}
              type="button"
              className="kiosk-row book-row"
              onClick={() => chooseLoan(l)}
            >
              <span className="book-title">
                {l.title}
                <span className="sub"> · {l.author}</span>
              </span>
              <span className={`badge ${l.badge.late ? "error" : "accent"}`}>
                {l.badge.label}
              </span>
            </button>
          ))}
        </div>
      </>
    );
  }

  if (step === "confirm" && member && loan) {
    return (
      <>
        <h1>Returning this one?</h1>
        <div className="kiosk-card confirm-card">
          <p className="confirm-book">{loan.title}</p>
          <p className="sub">{loan.author}</p>
          <div className="confirm-facts">
            <div className="row">
              <span className="sub">Borrower</span>
              <span>{member.full_name}</span>
            </div>
            <div className="row">
              <span className="sub">Status</span>
              <span className={`badge ${loan.badge.late ? "error" : "accent"}`}>
                {loan.badge.label}
              </span>
            </div>
          </div>
          {confirmError && <p className="confirm-error">{confirmError}</p>}
          <button
            type="button"
            className="big-btn primary"
            onClick={confirmReturn}
            disabled={confirming}
          >
            {confirming ? "One moment…" : "Yes — return this book"}
          </button>
          <button type="button" className="link-btn" onClick={() => setStep("loans")}>
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
        <h1>Thank you!</h1>
        <p className="lede">
          {result.bookTitle} is back on the shelf.{" "}
          {result.remainingLoans === 0
            ? "You're all square."
            : `You still have ${result.remainingLoans} book${
                result.remainingLoans === 1 ? "" : "s"
              } out.`}
        </p>
        <button type="button" className="big-btn primary" onClick={() => router.push("/")}>
          Done
        </button>
        <AutoHome seconds={8} />
      </div>
    );
  }

  return null;
}
