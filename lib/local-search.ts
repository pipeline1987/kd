import type { SearchRecord } from "@/lib/types";

type SearchRequest = {
  indexName: string;
  params?: string | Record<string, unknown>;
};

type FacetHit = { value: string; highlighted: string; count: number };

function asParams(raw: SearchRequest["params"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw !== "string") return raw;
  const params = new URLSearchParams(raw);
  const out: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    if (
      key === "facetFilters" ||
      key === "numericFilters" ||
      key === "facets" ||
      key === "attributesToRetrieve"
    ) {
      try {
        out[key] = JSON.parse(value);
      } catch {
        out[key] = value;
      }
    } else if (key === "page" || key === "hitsPerPage" || key === "maxValuesPerFacet") {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

function haystack(record: SearchRecord): string {
  return [
    record.title,
    record.excerpt,
    record.author,
    record.rank,
    record.era,
    record.location,
    record.missionId,
    record.topics.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function highlight(
  text: string,
  tokens: string[],
  pre: string,
  post: string,
): { value: string; matchLevel: "none" | "partial" | "full" } {
  if (!tokens.length) return { value: text, matchLevel: "none" };
  const lower = text.toLowerCase();
  let matched = 0;
  let value = text;
  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index === -1) continue;
    matched += 1;
    const re = new RegExp(`(${token})`, "ig");
    value = value.replace(re, `${pre}$1${post}`);
  }
  return {
    value,
    matchLevel: matched === 0 ? "none" : matched >= tokens.length ? "full" : "partial",
  };
}

function matchesQuery(record: SearchRecord, tokens: string[]): boolean {
  if (!tokens.length) return true;
  const text = haystack(record);
  return tokens.every((token) => text.includes(token));
}

function matchesFacetFilters(
  record: SearchRecord,
  facetFilters: unknown,
): boolean {
  if (!facetFilters) return true;
  const groups = Array.isArray(facetFilters) ? facetFilters : [facetFilters];
  return groups.every((group) => {
    const clauses = Array.isArray(group) ? group : [group];
    return clauses.some((clause) => {
      if (typeof clause !== "string") return false;
      const split = clause.indexOf(":");
      const attribute = clause.slice(0, split);
      const value = clause.slice(split + 1);
      const data = record[attribute as keyof SearchRecord];
      if (Array.isArray(data)) return data.map(String).includes(value);
      return String(data) === value;
    });
  });
}

function matchesNumericFilters(
  record: SearchRecord,
  numericFilters: unknown,
): boolean {
  if (!numericFilters) return true;
  const filters = Array.isArray(numericFilters)
    ? numericFilters
    : [numericFilters];
  return filters.every((filter) => {
    if (typeof filter !== "string") return true;
    const match = filter.match(/(\w+)([<>]=?|=)(-?\d+)/);
    if (!match) return true;
    const [, attribute, op, raw] = match;
    const left = Number(record[attribute as keyof SearchRecord]);
    const right = Number(raw);
    if (op === ">=") return left >= right;
    if (op === "<=") return left <= right;
    if (op === ">") return left > right;
    if (op === "<") return left < right;
    return left === right;
  });
}

function facetValues(
  records: SearchRecord[],
  attribute: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const data = record[attribute as keyof SearchRecord];
    const values = Array.isArray(data) ? data : [data];
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const key = String(value);
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

export function createLocalSearchClient(records: SearchRecord[]) {
  const sorted = [...records].sort((a, b) => b.publishedAt - a.publishedAt);

  return {
    applicationID: "KONOHA-LOCAL",
    search(requests: SearchRequest[]) {
      const started = Date.now();
      const results = requests.map((request) => {
        const params = asParams(request.params);
        const query = String(params.query ?? "");
        const tokens = tokenize(query);
        const hitsPerPage = Number(params.hitsPerPage ?? 12);
        const page = Number(params.page ?? 0);
        const pre = String(params.highlightPreTag ?? "<mark>");
        const post = String(params.highlightPostTag ?? "</mark>");
        const requestedFacets = (params.facets as string[] | undefined) ?? [];
        const defaultFacets = ["rank", "author", "topics", "year", "month", "era"];
        const facets = requestedFacets.includes("*")
          ? defaultFacets
          : requestedFacets.length > 0
            ? requestedFacets
            : defaultFacets;
        const maxValues = Number(params.maxValuesPerFacet ?? 100);

        const filtered = sorted.filter(
          (record) =>
            matchesQuery(record, tokens) &&
            matchesFacetFilters(record, params.facetFilters) &&
            matchesNumericFilters(record, params.numericFilters),
        );

        const start = page * hitsPerPage;
        const hits = filtered.slice(start, start + hitsPerPage).map((record) => ({
          ...record,
          objectID: record.objectID,
          __position: start,
          _highlightResult: {
            title: highlight(record.title, tokens, pre, post),
            excerpt: highlight(record.excerpt, tokens, pre, post),
            author: highlight(record.author, tokens, pre, post),
          },
        }));

        const facetCounts: Record<string, Record<string, number>> = {};
        for (const facet of facets) {
          const counts = facetValues(filtered, facet);
          const entries = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxValues);
          facetCounts[facet] = Object.fromEntries(entries);
        }

        return {
          hits,
          nbHits: filtered.length,
          page,
          nbPages: Math.max(1, Math.ceil(filtered.length / hitsPerPage)),
          hitsPerPage,
          processingTimeMS: Math.max(1, Date.now() - started),
          query,
          params: typeof request.params === "string" ? request.params : "",
          index: request.indexName,
          exhaustiveNbHits: true,
          exhaustiveFacetsCount: true,
          facets: facetCounts,
        };
      });

      return Promise.resolve({ results });
    },
    searchForFacetValues(
      requests: Array<{
        indexName: string;
        params: { facetName: string; facetQuery?: string; maxFacetHits?: number };
      }>,
    ) {
      return Promise.resolve({
        results: requests.map((request) => {
          const { facetName, facetQuery = "", maxFacetHits = 10 } = request.params;
          const q = facetQuery.toLowerCase();
          const counts = facetValues(sorted, facetName);
          const facetHits: FacetHit[] = Object.entries(counts)
            .filter(([value]) => !q || value.toLowerCase().includes(q))
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxFacetHits)
            .map(([value, count]) => ({
              value,
              count,
              highlighted: q
                ? value.replace(
                    new RegExp(`(${q})`, "ig"),
                    "<mark>$1</mark>",
                  )
                : value,
            }));
          return {
            facetHits,
            exhaustiveFacetsCount: true,
            processingTimeMS: 1,
          };
        }),
      });
    },
  };
}
