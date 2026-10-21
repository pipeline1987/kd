import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportCard } from "@/components/ReportCard";
import { authors, getArticlesByAuthor, getAuthor } from "@/lib/articles";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return authors.map((author) => ({ slug: author.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthor(slug);
  if (!author) return { title: "Correspondent not found" };
  return {
    title: author.name,
    description: author.bio,
  };
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const author = getAuthor(slug);
  if (!author) notFound();
  const reports = getArticlesByAuthor(slug);

  return (
    <main className="edition">
      <header className="page-intro">
        <p className="kicker">{author.title}</p>
        <h1>{author.name}</h1>
        <p>{author.bio}</p>
        <p className="byline">
          {author.beat} · {author.tenure} · {reports.length} reports in the ledger
        </p>
      </header>
      <div className="card-grid">
        {reports.map((report) => (
          <ReportCard key={report.slug} report={report} />
        ))}
      </div>
    </main>
  );
}
