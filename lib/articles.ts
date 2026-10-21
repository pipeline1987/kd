import "server-only";
import articlesJson from "@/data/articles.json";
import { authors, authorsBySlug } from "@/data/authors";
import type { Article, Author } from "@/lib/types";

export const articles = articlesJson as Article[];

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}

export function getArticlesByAuthor(authorSlug: string): Article[] {
  return articles.filter((article) => article.authorSlug === authorSlug);
}

export function getArticlesByTopic(topic: string): Article[] {
  return articles.filter((article) => article.topics.includes(topic));
}

export function getFeaturedArticles(limit = 8): Article[] {
  return articles
    .filter((article) => article.featured)
    .slice()
    .sort((a, b) => a.publishedAt - b.publishedAt)
    .slice(0, limit);
}

export function getLatestArticles(limit = 12): Article[] {
  return articles.slice(0, limit);
}

export function getLeadArticle(): Article {
  return (
    articles.find((article) => article.featured && article.year >= 83) ??
    articles[0]!
  );
}

export function getTopics(): { topic: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const topic of article.topics) {
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

export function getYears(): number[] {
  return [...new Set(articles.map((article) => article.year))].sort(
    (a, b) => b - a,
  );
}

export function getAuthor(slug: string): Author | undefined {
  return authorsBySlug[slug];
}

export { authors };
