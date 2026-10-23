import type { Metadata } from "next";
import { DeskChat } from "@/components/DeskChat";

export const metadata: Metadata = {
  title: "Ask the desk",
  description:
    "Ask the Konoha Daily mission desk about twenty years of public mission reports.",
};

export default function DeskPage() {
  return (
    <main className="edition desk-page">
      <header className="page-intro">
        <p className="kicker">ANBU · Public briefing</p>
        <h1>Ask the desk</h1>
        <p>
          The clerk searches the mission archive, opens the matching files, and
          answers from those reports. Nothing leaves the public ledger.
        </p>
      </header>
      <DeskChat />
    </main>
  );
}
