import type { Article, MissionStatus, Rank } from "./types";

export const ARCHIVE_START_YEAR = 64;
export const ARCHIVE_END_YEAR = 83;
export const INDEX_NAME = "konoha_daily";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function eraFor(year: number): string {
  if (year <= 64) return "Konoha Crush";
  if (year <= 66) return "Quiet Years";
  if (year <= 68) return "Akatsuki & War";
  if (year <= 74) return "Blank Period";
  if (year <= 82) return "Seventh's Peace";
  return "New Generation";
}

export function toTimestamp(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(2006 + (year - 64), month - 1, day) / 1000);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function formatDateline(article: {
  year: number;
  month: number;
  day: number;
}): string {
  return `${MONTHS[article.month - 1]} ${article.day}, Year ${article.year}`;
}

export function formatRyo(amount: number): string {
  return `${amount.toLocaleString("en-US")} ryō`;
}

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? "";
}

export function makeArticle(input: {
  year: number;
  month: number;
  day: number;
  title: string;
  excerpt: string;
  body: string[];
  author: string;
  authorSlug: string;
  rank: Rank;
  topics: string[];
  location: string;
  feeRyo: number;
  status?: MissionStatus;
  classified?: boolean;
  featured?: boolean;
  sequence: number;
}): Article {
  const missionId = `KD-${input.year}-${String(input.sequence).padStart(4, "0")}`;
  const slug = `${missionId.toLowerCase()}-${slugify(input.title)}`;
  return {
    objectID: slug,
    slug,
    missionId,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    author: input.author,
    authorSlug: input.authorSlug,
    rank: input.rank,
    topics: input.topics,
    year: input.year,
    month: input.month,
    day: input.day,
    publishedAt: toTimestamp(input.year, input.month, input.day),
    era: eraFor(input.year),
    location: input.location,
    feeRyo: input.feeRyo,
    status: input.status ?? (input.classified ? "Classified" : "Completed"),
    classified: Boolean(input.classified),
    featured: Boolean(input.featured),
  };
}
