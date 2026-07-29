import BorrowFlow from "@/components/kiosk/BorrowFlow";
import IdleRedirect from "@/components/kiosk/IdleRedirect";

export default function BorrowPage() {
  return (
    <main className="kiosk-page">
      <IdleRedirect seconds={60} />
      <BorrowFlow />
    </main>
  );
}
