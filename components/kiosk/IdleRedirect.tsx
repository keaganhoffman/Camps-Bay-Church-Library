"use client";

import { useEffect } from "react";

// Shared-device safety net: after `seconds` with no interaction,
// go back to the Welcome screen. Uses a full page load (not client
// navigation) so every bit of state — including a half-entered PIN —
// is guaranteed gone before the next person walks up.
export default function IdleRedirect({ seconds = 60 }: { seconds?: number }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => window.location.replace("/"), seconds * 1000);
    };

    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, restart, { passive: true }));
    restart();

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, restart));
    };
  }, [seconds]);

  return null;
}
