import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <LeafMark className="footer-leaf" />
        <div>
          <p className="masthead-title footer-title">Konoha Daily</p>
          <p>All ranks, D to S, reported daily.</p>
        </div>
      </div>
      <p className="footer-note">
        An ANBU-styled Konohagakure fan ledger. Mission reports are dummy
        dispatches inspired
        by the Naruto series. Naruto is © Masashi Kishimoto / Shueisha / TV
        Tokyo / Pierrot. This site is not affiliated with the rights holders.
        Lore consulted from{" "}
        <a href="https://naruto.fandom.com/wiki/Naruto_(series)">Narutopedia</a>.
      </p>
      <p className="footer-links">
        <Link href="/archive">Search the archive</Link>
        <Link href="/desk">Ask the desk</Link>
        <Link href="/intel">Search intel</Link>
        <Link href="/about">About the desk</Link>
      </p>
    </footer>
  );
}
