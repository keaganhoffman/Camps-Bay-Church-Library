import Link from "next/link";
import IdleRedirect from "@/components/kiosk/IdleRedirect";

// Placeholder — the real admin area (behind the 6-digit PIN) arrives in Phase 6.
export default function AdminPage() {
  return (
    <main className="kiosk-page">
      <IdleRedirect seconds={60} />
      <div className="kiosk-card">
        <h1>Admin</h1>
        <p className="lede">The admin area arrives in Phase 6.</p>
        <Link href="/" className="big-btn" style={{ marginTop: 24 }}>
          Back to start
        </Link>
      </div>
    </main>
  );
}
