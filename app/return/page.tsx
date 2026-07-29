import Link from "next/link";

// Placeholder — the real return flow arrives in Phase 3.
export default function ReturnPage() {
  return (
    <main className="kiosk-page">
      <div className="kiosk-card">
        <h1>Returns are coming soon</h1>
        <p className="lede">
          For now, please leave the book at the desk — thank you!
        </p>
        <Link href="/" className="big-btn primary" style={{ marginTop: 24 }}>
          Back to start
        </Link>
      </div>
    </main>
  );
}
