"use client";

import { useState } from "react";

// iOS-lock-screen-style PIN pad: round keys, filled-dot progress.
// Submits automatically when all digits are entered. onSubmit returns
// null on success, or a message to show — a wrong PIN shakes the dots
// and clears for another try.
export default function PinPad({
  length = 4,
  onSubmit,
}: {
  length?: number;
  onSubmit: (pin: string) => Promise<string | null>;
}) {
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function pressDigit(d: string) {
    if (busy || digits.length >= length) return;
    const next = digits + d;
    setDigits(next);
    if (next.length < length) return;

    setBusy(true);
    const error = await onSubmit(next);
    setBusy(false);
    if (error !== null) {
      setMessage(error);
      setShaking(true);
      setTimeout(() => {
        setShaking(false);
        setDigits("");
      }, 500);
    }
  }

  function pressBackspace() {
    if (busy) return;
    setDigits(digits.slice(0, -1));
  }

  return (
    <div className="pinpad">
      <div className={`pin-dots${shaking ? " shake" : ""}`}>
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`pin-dot${i < digits.length ? " filled" : ""}`} />
        ))}
      </div>
      <p className="pin-message">{message ?? " "}</p>
      <div className="pin-keys">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className="pin-key" onClick={() => pressDigit(d)}>
            {d}
          </button>
        ))}
        <span aria-hidden />
        <button type="button" className="pin-key" onClick={() => pressDigit("0")}>
          0
        </button>
        <button
          type="button"
          className="pin-key pin-key-light"
          onClick={pressBackspace}
          aria-label="Delete"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
