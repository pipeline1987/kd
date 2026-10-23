import "server-only";

import { algoliasearch } from "algoliasearch";
import { formatDateline, INDEX_NAME } from "@/lib/article";
import { articles, getArticle } from "@/lib/articles";
import { parseNaturalQuery } from "@/lib/natural-query";
import { prepareIndex, rankRecords } from "@/lib/search-relevance";
import type { Article, Rank, SearchRecord } from "@/lib/types";

export type DeskSource = {
  slug: string;
  title: string;
  missionId: string;
  rank: Rank;
  year: number;
  author: string;
  href: string;
};

export type DeskHit = DeskSource & {
  excerpt: string;
  location: string;
  topics: string[];
  status: string;
  dateline: string;
};

const searchRecords: SearchRecord[] = articles.map((article) => ({
  ...article,
  body: article.body.join("\n"),
}));

const index = prepareIndex(searchRecords);

function asSource(article: Article): DeskSource {
  return {
    slug: article.slug,
    title: article.title,
    missionId: article.missionId,
    rank: article.rank,
    year: article.year,
    author: article.author,
    href: `/reports/${article.slug}`,
  };
}

function asHit(article: Article): DeskHit {
  return {
    ...asSource(article),
    excerpt: article.excerpt,
    location: article.location,
    topics: article.topics,
    status: article.status,
    dateline: formatDateline(article),
  };
}

function applyHints(
  hits: Article[],
  hints: { rank?: Rank; year?: number; topic?: string },
): Article[] {
  return hits.filter((article) => {
    if (hints.rank && article.rank !== hints.rank) return false;
    if (hints.year && article.year !== hints.year) return false;
    if (
      hints.topic &&
      !article.topics.some(
        (topic) => topic.toLowerCase() === hints.topic!.toLowerCase(),
      )
    ) {
      return false;
    }
    return true;
  });
}

function searchLocal(
  query: string,
  hints: { rank?: Rank; year?: number; topic?: string },
  limit: number,
): Article[] {
  const intent = parseNaturalQuery(query);
  const ranked = rankRecords(index, intent.coreTokens, {
    tokens: intent.coreTokens,
    termWeights: intent.termWeights,
    natural: intent.isNatural,
    preferRank: hints.rank ?? intent.rank,
    preferYears: hints.year ? [hints.year] : intent.years,
    preferMonths: intent.months,
    preferEras: intent.eras,
    preferStatus: intent.status,
    preferClassified: intent.classified,
    preferAuthor: intent.author,
    preferLocation: intent.location,
    preferTopics: hints.topic ? [hints.topic] : intent.topics,
  });
  const hydrated = ranked
    .map((record) => getArticle(record.slug) ?? getArticle(record.objectID))
    .filter((article): article is Article => Boolean(article));
  return applyHints(hydrated, hints).slice(0, limit);
}

async function searchAlgolia(
  query: string,
  hints: { rank?: Rank; year?: number; topic?: string },
  limit: number,
): Promise<Article[] | null> {
  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;
  if (!appId || !apiKey || appId === "local") return null;
  const facetFilters: string[] = [];
  if (hints.rank) facetFilters.push(`rank:${hints.rank}`);
  if (hints.year) facetFilters.push(`year:${hints.year}`);
  if (hints.topic) facetFilters.push(`topics:${hints.topic}`);
  try {
    const client = algoliasearch(appId, apiKey);
    const response = await client.searchSingleIndex<{
      objectID: string;
      slug?: string;
    }>({
      indexName: INDEX_NAME,
      searchParams: {
        query,
        hitsPerPage: limit,
        attributesToRetrieve: ["objectID", "slug"],
        facetFilters: facetFilters.length ? facetFilters : undefined,
        analyticsTags: ["desk"],
      },
    });
    return (response.hits ?? [])
      .map((hit) => getArticle(hit.slug ?? hit.objectID))
      .filter((article): article is Article => Boolean(article));
  } catch {
    return null;
  }
}

export async function searchMissions(input: {
  query: string;
  rank?: Rank;
  year?: number;
  topic?: string;
  limit?: number;
}): Promise<DeskHit[]> {
  const query = input.query.trim().slice(0, 180);
  const limit = Math.min(8, Math.max(1, input.limit ?? 6));
  const hints = { rank: input.rank, year: input.year, topic: input.topic };
  const fromCloud = query
    ? await searchAlgolia(query, hints, limit)
    : null;
  const local = searchLocal(query, hints, limit);
  const hits = [
    ...(fromCloud ?? []),
    ...local.filter(
      (article) => !(fromCloud ?? []).some((hit) => hit.slug === article.slug),
    ),
  ].slice(0, limit);
  return hits.map(asHit);
}

export function readMission(slug: string): (DeskHit & { body: string[] }) | null {
  const article = getArticle(slug.trim()) ?? getArticle(slug.trim().toLowerCase());
  if (!article) return null;
  return {
    ...asHit(article),
    body: article.body.slice(0, 6),
  };
}

export const DESK_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_missions",
      description:
        "Search the Konoha Daily public mission ledger by natural-language question, name, rank, year, or topic. Use this before answering.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query, for example 'Pain razed Konoha' or 'Seventh Hokage'.",
          },
          rank: {
            type: "string",
            enum: ["S", "A", "B", "C", "D"],
          },
          year: {
            type: "integer",
            description: "Konoha year 64–83",
          },
          topic: {
            type: "string",
            description: "Topic facet such as Akatsuki, Hokage, or Civic",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_mission",
      description:
        "Read the public text of one mission report after search_missions. Pass the slug from a hit.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string" },
        },
        required: ["slug"],
      },
    },
  },
];

export async function runDeskTool(
  name: string,
  raw: string,
): Promise<{ result: string; sources: DeskSource[] }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    args = {};
  }

  if (name === "search_missions") {
    const hits = await searchMissions({
      query: String(args.query ?? ""),
      rank: ["S", "A", "B", "C", "D"].includes(String(args.rank))
        ? (args.rank as Rank)
        : undefined,
      year:
        typeof args.year === "number" && Number.isFinite(args.year)
          ? args.year
          : undefined,
      topic: typeof args.topic === "string" ? args.topic : undefined,
    });
    return {
      result: JSON.stringify(
        hits.map((hit) => ({
          slug: hit.slug,
          title: hit.title,
          missionId: hit.missionId,
          rank: hit.rank,
          year: hit.year,
          author: hit.author,
          location: hit.location,
          topics: hit.topics,
          excerpt: hit.excerpt,
          href: hit.href,
        })),
      ),
      sources: hits,
    };
  }

  if (name === "read_mission") {
    const report = readMission(String(args.slug ?? ""));
    if (!report) {
      return { result: JSON.stringify({ error: "File not in the ledger." }), sources: [] };
    }
    return {
      result: JSON.stringify(report),
      sources: [report],
    };
  }

  return { result: JSON.stringify({ error: `Unknown tool ${name}` }), sources: [] };
}
