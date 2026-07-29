import SignupFlow from "@/components/kiosk/SignupFlow";
import IdleRedirect from "@/components/kiosk/IdleRedirect";

export default function JoinPage() {
  return (
    <main className="kiosk-page">
      {/* A little more idle grace than the borrow flow — people pause
          to think while choosing a PIN. Any keystroke resets it. */}
      <IdleRedirect seconds={120} />
      <SignupFlow />
    </main>
  );
}
