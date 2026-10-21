import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";
import { ARCHIVE_END_YEAR, ARCHIVE_START_YEAR } from "@/lib/article";

export function Masthead({ dateline }: { dateline: string }) {
  return (
    <header className="masthead">
      <div className="masthead-top">
        <p className="masthead-place">ANBU · Hidden Leaf</p>
        <p className="masthead-date">{dateline}</p>
        <p className="masthead-volume">
          File {ARCHIVE_END_YEAR - ARCHIVE_START_YEAR + 1} · Years{" "}
          {ARCHIVE_START_YEAR}–{ARCHIVE_END_YEAR}
        </p>
      </div>
      <div className="masthead-brand">
        <LeafMark className="masthead-leaf" />
        <div>
          <p className="masthead-kicker">Black ops public ledger</p>
          <Link href="/" className="masthead-title">
            Konoha Daily
          </Link>
          <p className="masthead-tag">All ranks, D to S, reported daily.</p>
        </div>
      </div>
      <nav className="masthead-nav" aria-label="Edition">
        <Link href="/">Latest file</Link>
        <Link href="/archive">Mission archive</Link>
        <Link href="/authors">Press corps</Link>
        <Link href="/intel">Search intel</Link>
        <Link href="/about">The desk</Link>
      </nav>
    </header>
  );
}
