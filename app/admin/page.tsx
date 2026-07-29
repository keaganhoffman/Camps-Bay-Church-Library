import Link from "next/link";

// Admin dashboard (the PIN gate lives in the layout).
export default function AdminHomePage() {
  return (
    <>
      <h1>Admin</h1>
      <p className="lede">What would you like to manage?</p>
      <div className="kiosk-list">
        <Link href="/admin/books" className="kiosk-row admin-link-row">
          <span>
            Books
            <span className="sub"> · add, edit, import your catalogue</span>
          </span>
        </Link>
        <Link href="/admin/members" className="kiosk-row admin-link-row">
          <span>
            Members
            <span className="sub"> · add, edit, reset PINs, import</span>
          </span>
        </Link>
        <Link href="/admin/loans" className="kiosk-row admin-link-row">
          <span>
            Loans
            <span className="sub"> · everything currently out, overdue filter</span>
          </span>
        </Link>
        <Link href="/admin/stock-count" className="kiosk-row admin-link-row">
          <span>
            Stock count
            <span className="sub"> · monthly shelf check with adjustments</span>
          </span>
        </Link>
      </div>
    </>
  );
}
