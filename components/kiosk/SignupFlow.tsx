"use client";

import { useState } from "react";
import Link from "next/link";

// Guest self-signup: name, surname, email, choose a 4-digit PIN
// (entered twice to catch typos). On success, straight to borrowing.
export default function SignupFlow() {
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pinRepeat, setPinRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!/^\d{4}$/.test(pin)) {
      setError("Your PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== pinRepeat) {
      setError("The two PINs don't match — try them again.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/kiosk/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, surname, email, pin }),
    });
    setBusy(false);

    if (res.ok) {
      const data = await res.json();
      setCreatedName(data.firstName);
      return;
    }
    const data = await res.json().catch(() => null);
    setError(data?.error ?? "Something went wrong — please try again.");
  }

  if (createdName) {
    return (
      <div className="kiosk-card success-card">
        <div className="success-mark">✓</div>
        <h1>Welcome, {createdName}!</h1>
        <p className="lede">
          Your library account is ready. Use your name and PIN whenever you borrow or return
          a book.
        </p>
        <Link href="/borrow" className="big-btn primary" style={{ marginTop: 24 }}>
          Borrow your first book
        </Link>
        <Link href="/" className="link-btn">
          Done
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1>Create your account</h1>
      <p className="lede">Takes less than a minute — then you can borrow straight away.</p>
      <form className="signup-form" onSubmit={submit}>
        <label className="kiosk-field">
          <span>First name</span>
          <input
            className="admin-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="kiosk-field">
          <span>Surname</span>
          <input
            className="admin-input"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="kiosk-field">
          <span>Email — for receipts and friendly reminders</span>
          <input
            className="admin-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <div className="signup-pins">
          <label className="kiosk-field">
            <span>Choose a 4-digit PIN</span>
            <input
              className="admin-input"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label className="kiosk-field">
            <span>Repeat your PIN</span>
            <input
              className="admin-input"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pinRepeat}
              onChange={(e) => setPinRepeat(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
        </div>
        {error && <p className="confirm-error">{error}</p>}
        <button type="submit" className="big-btn primary" disabled={busy}>
          {busy ? "One moment…" : "Create my account"}
        </button>
      </form>
      <Link href="/" className="link-btn">
        Back to start
      </Link>
    </>
  );
}
