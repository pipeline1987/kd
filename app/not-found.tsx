import Link from "next/link";

export default function NotFound() {
  return (
    <main className="edition page-intro">
      <p className="kicker">Missing-nin file</p>
      <h1>No such scroll</h1>
      <p>That mission report is not in the ledger.</p>
      <p>
        <Link href="/archive">Search the archive</Link>
      </p>
    </main>
  );
}
