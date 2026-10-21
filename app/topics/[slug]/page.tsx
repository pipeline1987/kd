import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportCard } from "@/components/ReportCard";
import { slugify } from "@/lib/article";
import { getArticlesByTopic, getTopics } from "@/lib/articles";

type Props = { params: Promise<{ slug: string }> };

function topicFromSlug(slug: string): string | undefined {
  return getTopics().find(({ topic }) => slugify(topic) === slug)?.topic;
}

export function generateStaticParams() {
  return getTopics().map(({ topic }) => ({ slug: slugify(topic) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = topicFromSlug(slug);
  if (!topic) return { title: "Topic not found" };
  return {
    title: topic,
    description: `Konoha Daily mission reports filed under ${topic}.`,
  };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const topic = topicFromSlug(slug);
  if (!topic) notFound();
  const reports = getArticlesByTopic(topic);

  return (
    <main className="edition">
      <header className="page-intro">
        <p className="kicker">Topic</p>
        <h1>{topic}</h1>
        <p>{reports.length} mission reports in the Konoha Daily archive.</p>
      </header>
      <div className="card-grid">
        {reports.map((report) => (
          <ReportCard key={report.slug} report={report} />
        ))}
      </div>
    </main>
  );
}
