import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The desk",
  description: "About Konoha Daily, the village ledger of mission reports.",
};

export default function AboutPage() {
  return (
    <main className="edition about-page">
      <header className="page-intro">
        <p className="kicker">Founded Year 64</p>
        <h1>Konoha Daily</h1>
        <p className="dek">All ranks, D to S, reported daily.</p>
      </header>
      <div className="scroll-body about-body">
        <p>
          After the Academy class of Year 64 was posted to genin teams, the
          Third Hokage’s staff argued the village needed a public ledger: not a
          gossip sheet, not a bingo book, a newspaper that would print what
          shinobi actually do. Konoha Daily opened a desk in the shadow of the
          Hokage Tower the same week Team 7 chased a cat named Tora.
        </p>
        <p>
          Every article in this archive is a mission report. D-rank weeding sits
          beside S-rank seals because the village eats on both. Readers can
          search twenty years of files — Konoha Years 64 through 83 — by topic,
          correspondent, rank, and date.
        </p>
        <p>
          The paper covered the Land of Waves, the Chūnin Exams, the invasion
          that took the Third, Tsunade’s hat, the Uchiha who left, the Akatsuki
          years, Pain’s crater, the Fourth Shinobi World War, Kakashi’s
          paperwork, the Seventh’s inauguration, and the generation that
          inherited the board. Lore was checked against{" "}
          <a href="https://naruto.fandom.com/wiki/Naruto_(series)">
            Narutopedia
          </a>{" "}
          and the mission ranks recorded there: D for genin errands, C when
          bandits are likely, B when enemy ninja are expected, A for
          village-level work, S for state secrets.
        </p>
        <p>
          This is a fan site. The names, villages, and wars belong to Masashi
          Kishimoto. The press corps — Kayo Shiranui at the masthead, Tsubaki in
          the mud, Udon on the civic desk — is invented so the ledger can have
          bylines. Nothing here is official. If a scroll is marked classified,
          we printed only what the seal would allow a civilian to overhear.
        </p>
        <p>
          <Link href="/archive">Search the archive</Link>
          {" · "}
          <Link href="/authors">Meet the press corps</Link>
        </p>
      </div>
    </main>
  );
}
