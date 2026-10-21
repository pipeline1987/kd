import type { Metadata } from "next";
import { SearchExperience } from "@/components/SearchExperience";

export const metadata: Metadata = {
  title: "Mission archive",
  description:
    "Search twenty years of Konoha Daily mission reports by topic, author, and date.",
};

export const dynamic = "force-dynamic";

export default function ArchivePage() {
  return (
    <main className="edition archive-page">
      <header className="page-intro">
        <p className="kicker">The ledger</p>
        <h1>Mission report archive</h1>
        <p>
          Twenty years of Konoha Daily dispatches. Search by keyword, then narrow
          by topic, correspondent, rank, or Konoha year.
        </p>
      </header>
      <SearchExperience />
    </main>
  );
}
