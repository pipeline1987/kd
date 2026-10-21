import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RankSeal } from "@/components/RankSeal";
import { ReportCard } from "@/components/ReportCard";
import { ReportInsights } from "@/components/ReportInsights";
import {
  formatDateline,
  formatRyo,
  slugify,
} from "@/lib/article";
import { articles, getArticle } from "@/lib/articles";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ qid?: string }>;
};

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Report not found" };
  return {
    title: article.title,
    description: article.excerpt,
  };
}

export default async function ReportPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { qid } = await searchParams;
  const article = getArticle(slug);
  if (!article) notFound();

  const commonTopics = new Set(["Civic", "Trade", "Hospital", "Medical", "Academy"]);
  const related = articles
    .filter((candidate) => candidate.slug !== article.slug)
    .map((candidate) => ({
      candidate,
      score:
        candidate.topics.filter(
          (topic) => article.topics.includes(topic) && !commonTopics.has(topic),
        ).length *
          2 +
        (candidate.era === article.era ? 2 : 0) +
        (candidate.featured ? 3 : 0) +
        (candidate.rank === article.rank ? 1 : 0),
    }))
    .filter((entry) => entry.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.candidate);

  return (
    <main className="edition report-page">
      <ReportInsights objectID={article.objectID} queryID={qid} />
      <article className="scroll">
        <p className="kicker">
          Mission {article.missionId} · {article.era} · {article.location}
        </p>
        <div className="scroll-head">
          <RankSeal rank={article.rank} size="lg" />
          <h1>{article.title}</h1>
        </div>
        <p className="dek">{article.excerpt}</p>
        <p className="byline">
          Filed {formatDateline(article)} by{" "}
          <Link href={`/authors/${article.authorSlug}`}>{article.author}</Link>
        </p>
        <dl className="mission-meta">
          <div>
            <dt>Rank</dt>
            <dd>{article.rank}-rank</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{article.status}</dd>
          </div>
          <div>
            <dt>Fee</dt>
            <dd>{article.feeRyo > 0 ? formatRyo(article.feeRyo) : "Village file"}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDateline(article)}</dd>
          </div>
        </dl>
        {article.classified ? (
          <aside className="classified">
            Sealed under the Hokage’s mark. Only the public lines of the scroll
            are printed.
          </aside>
        ) : null}
        <div className="scroll-body">
          {article.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <ul className="topic-row">
          {article.topics.map((topic) => (
            <li key={topic}>
              <Link href={`/topics/${slugify(topic)}`}>{topic}</Link>
            </li>
          ))}
        </ul>
      </article>
      {related.length ? (
        <aside className="related">
          <h2>Related files</h2>
          <div className="card-grid">
            {related.map((report) => (
              <ReportCard key={report.slug} report={report} />
            ))}
          </div>
        </aside>
      ) : null}
    </main>
  );
}
