"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

// Live camera barcode scanner for book ISBNs (EAN-13 and friends).
// Uses the rear camera and calls onDetected exactly once, then stops.
// Remount (change the key) to scan again. If the camera can't start
// (no permission, no camera), it shows a gentle note — the search
// list below every scanner remains the failsafe.
export default function BarcodeScanner({
  onDetected,
  hint = "Point the camera at the barcode on the back cover",
}: {
  onDetected: (code: string) => void;
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest callback without restarting the camera on
  // parent re-renders.
  const callbackRef = useRef(onDetected);
  useEffect(() => {
    callbackRef.current = onDetected;
  });

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
    ]);
    const reader = new BrowserMultiFormatReader(hints);

    let controls: IScannerControls | null = null;
    let finished = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result, _err, c) => {
          controls = c;
          if (result && !finished) {
            finished = true;
            c.stop();
            callbackRef.current(result.getText());
          }
        }
      )
      .then((c) => {
        controls = c;
        if (finished) c.stop();
      })
      .catch(() => {
        setError(
          "Couldn't open the camera — it may need permission in Settings. You can still search for the book instead."
        );
      });

    return () => {
      finished = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner-video" muted playsInline />
      <p className="sub scanner-hint">{error ?? hint}</p>
    </div>
  );
}
