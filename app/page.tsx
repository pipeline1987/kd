import Link from "next/link";
import { HomeSearch } from "@/components/HomeSearch";
import { RankSeal } from "@/components/RankSeal";
import { ReportCard } from "@/components/ReportCard";
import {
  ARCHIVE_END_YEAR,
  ARCHIVE_START_YEAR,
  formatDateline,
  slugify,
} from "@/lib/article";
import {
  articles,
  getFeaturedArticles,
  getLatestArticles,
  getLeadArticle,
  getTopics,
  getYears,
} from "@/lib/articles";
import type { Rank } from "@/lib/types";

const RANKS: Rank[] = ["S", "A", "B", "C", "D"];

export default function Home() {
  const lead = getLeadArticle();
  const latest = getLatestArticles(8).filter((article) => article.slug !== lead.slug);
  const featured = getFeaturedArticles(6).filter((article) => article.slug !== lead.slug);
  const years = getYears();
  const topics = getTopics().slice(0, 16);
  const byRank = RANKS.map((rank) => ({
    rank,
    report: articles.find((article) => article.rank === rank)!,
    count: articles.filter((article) => article.rank === rank).length,
  }));

  return (
    <main className="edition">
      <HomeSearch />

      <section className="lead-grid">
        <article className="lead-story">
          <RankSeal rank={lead.rank} size="lg" />
          <p className="kicker">
            Lead dispatch · {lead.location} · {formatDateline(lead)}
          </p>
          <h1>
            <Link href={`/reports/${lead.slug}`}>{lead.title}</Link>
          </h1>
          <p className="dek">{lead.excerpt}</p>
          <p className="byline">
            Filed by{" "}
            <Link href={`/authors/${lead.authorSlug}`}>{lead.author}</Link>
            {lead.feeRyo > 0 ? ` · ${formatRyo(lead.feeRyo)}` : " · Village file"}
          </p>
          <p className="lead-body">{lead.body[0]}</p>
          <Link className="read-link" href={`/reports/${lead.slug}`}>
            Continue the report
          </Link>
        </article>
        <aside className="column-latest">
          <h2>From the Mission Desk</h2>
          <ol>
            {latest.slice(0, 6).map((report) => (
              <li key={report.slug}>
                <span className="mini-rank">{report.rank}</span>
                <div>
                  <Link href={`/reports/${report.slug}`}>{report.title}</Link>
                  <p>
                    {formatDateline(report)} · {report.author}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="rank-rail" aria-label="Latest by rank">
        {byRank.map(({ rank, report, count }) => (
          <article key={rank}>
            <header>
              <RankSeal rank={rank} size="sm" />
              <Link href={`/archive?rank=${rank}`}>{count} reports</Link>
            </header>
            <h3>
              <Link href={`/reports/${report.slug}`}>{report.title}</Link>
            </h3>
            <p>{formatDateline(report)}</p>
          </article>
        ))}
      </section>

      <section className="year-spine">
        <div className="section-head">
          <h2>Twenty years in the ledger</h2>
          <p>
            Konoha Years {ARCHIVE_START_YEAR}–{ARCHIVE_END_YEAR}. Search any year,
            correspondent, or topic.
          </p>
        </div>
        <ol>
          {years.map((year) => (
            <li key={year}>
              <Link href={`/archive?year=${year}`}>
                <span>Year {year}</span>
                <small>
                  {articles.filter((article) => article.year === year).length}{" "}
                  files
                </small>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="featured-grid">
        <div className="section-head">
          <h2>From the archives</h2>
          <p>Landmark missions, filed as they happened.</p>
        </div>
        <div className="card-grid">
          {featured.map((report) => (
            <ReportCard key={report.slug} report={report} />
          ))}
        </div>
      </section>

      <section className="topic-index">
        <div className="section-head">
          <h2>Search by topic</h2>
        </div>
        <ul>
          {topics.map(({ topic, count }) => (
            <li key={topic}>
              <Link href={`/topics/${slugify(topic)}`}>
                {topic}
                <span>{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
