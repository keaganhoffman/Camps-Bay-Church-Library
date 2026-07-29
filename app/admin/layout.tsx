import AdminGate from "@/components/admin/AdminGate";
import IdleRedirect from "@/components/kiosk/IdleRedirect";

// Every /admin page sits behind the PIN gate. Admin work (counting
// stock, editing members) takes longer than a kiosk borrow, so the
// idle reset is 5 minutes here instead of 60 seconds.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="kiosk-page admin-page">
      <IdleRedirect seconds={300} />
      <AdminGate>{children}</AdminGate>
    </main>
  );
}
