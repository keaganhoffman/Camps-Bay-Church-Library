"use client";

import { useEffect } from "react";

// On success screens most people simply walk away — return to the
// Welcome screen by ourselves after a few seconds (full reload, so
// all state is wiped for the next person).
export default function AutoHome({ seconds = 8 }: { seconds?: number }) {
  useEffect(() => {
    const timer = setTimeout(() => window.location.replace("/"), seconds * 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  return <p className="auto-home-note">Heading back to the start in a moment…</p>;
}
