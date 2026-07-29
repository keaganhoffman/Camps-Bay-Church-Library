import Link from "next/link";

// The kiosk Welcome screen — where the iPad lives all day.
export default function WelcomePage() {
  return (
    <main className="kiosk-page welcome-page">
      <div className="welcome-inner">
        <h1>Library</h1>
        <p className="lede">Welcome! What would you like to do?</p>
        <div className="welcome-actions">
          <Link href="/borrow" className="big-btn primary">
            Borrow a book
          </Link>
          <Link href="/return" className="big-btn">
            Return a book
          </Link>
        </div>
      </div>
      <footer className="kiosk-footer">
        <Link href="/admin">Admin</Link>
      </footer>
    </main>
  );
}
