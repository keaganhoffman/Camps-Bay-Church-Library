import ReturnFlow from "@/components/kiosk/ReturnFlow";
import IdleRedirect from "@/components/kiosk/IdleRedirect";

export default function ReturnPage() {
  return (
    <main className="kiosk-page">
      <IdleRedirect seconds={60} />
      <ReturnFlow />
    </main>
  );
}
