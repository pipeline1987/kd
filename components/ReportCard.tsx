import Link from "next/link";
import { RankSeal } from "@/components/RankSeal";
import { formatDateline } from "@/lib/article";
import { slugify } from "@/lib/article";
import type { Article, SearchRecord } from "@/lib/types";

type CardSource = Pick<
  Article,
  | "slug"
  | "title"
  | "excerpt"
  | "author"
  | "authorSlug"
  | "rank"
  | "topics"
  | "year"
  | "month"
  | "day"
  | "location"
>;

export function ReportCard({
  report,
  kicker,
}: {
  report: CardSource | SearchRecord;
  kicker?: string;
}) {
  return (
    <article className="report-card">
      <div className="report-card-seal">
        <RankSeal rank={report.rank} size="sm" />
      </div>
      <p className="kicker">
        {kicker ?? report.location} · {formatDateline(report)}
      </p>
      <h3>
        <Link href={`/reports/${report.slug}`}>{report.title}</Link>
      </h3>
      <p className="excerpt">{report.excerpt}</p>
      <p className="byline">
        Filed by{" "}
        <Link href={`/authors/${report.authorSlug}`}>{report.author}</Link>
      </p>
      <ul className="topic-row">
        {report.topics.slice(0, 3).map((topic) => (
          <li key={topic}>
            <Link href={`/topics/${slugify(topic)}`}>{topic}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
