import { liteClient as algoliasearch } from "algoliasearch/lite";
import type { InstantSearchProps } from "react-instantsearch";
import searchRecords from "@/data/search-records.json";
import { INDEX_NAME } from "@/lib/article";
import { createLocalSearchClient } from "@/lib/local-search";
import { rewriteForKeywordEngine } from "@/lib/natural-query";
import { trackSearchEvent } from "@/lib/track-search";
import type { SearchRecord } from "@/lib/types";

export { INDEX_NAME };

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

export const usingAlgoliaCloud = Boolean(
  appId && apiKey && appId !== "local" && apiKey !== "local",
);

type SearchRequest = {
  indexName: string;
  params?: string | Record<string, unknown>;
};

function rewriteRequest(request: SearchRequest): SearchRequest {
  const raw = request.params;
  if (!raw) return request;
  if (typeof raw === "string") {
    const params = new URLSearchParams(raw);
    const query = params.get("query") ?? "";
    const rewritten = rewriteForKeywordEngine(query);
    if (rewritten === query) return request;
    params.set("query", rewritten);
    return { ...request, params: params.toString() };
  }
  const query = String(raw.query ?? "");
  const rewritten = rewriteForKeywordEngine(query);
  if (rewritten === query) return request;
  return { ...request, params: { ...raw, query: rewritten } };
}

function requestQuery(request: SearchRequest | undefined): string {
  if (!request?.params) return "";
  if (typeof request.params === "string") {
    return new URLSearchParams(request.params).get("query") ?? "";
  }
  return String(request.params.query ?? "");
}

function requestFilters(request: SearchRequest | undefined): string[] {
  if (!request?.params) return [];
  let raw: unknown;
  if (typeof request.params === "string") {
    const encoded = new URLSearchParams(request.params).get("facetFilters");
    if (!encoded) return [];
    try {
      raw = JSON.parse(encoded);
    } catch {
      return [];
    }
  } else {
    raw = request.params.facetFilters;
  }
  const filters: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string" && value.length > 0) filters.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
  };
  walk(raw);
  return filters.slice(0, 24);
}

let searchLogTimer: ReturnType<typeof setTimeout> | undefined;

function logMainSearch(request: SearchRequest | undefined, result: { queryID?: string; nbHits?: number; page?: number } | undefined) {
  if (typeof window === "undefined" || !result) return;
  const query = requestQuery(request);
  const nbHits = Number(result.nbHits ?? 0);
  window.clearTimeout(searchLogTimer);
  searchLogTimer = window.setTimeout(() => {
    trackSearchEvent({
      type: nbHits === 0 ? "empty" : "search",
      query,
      queryID: String(result.queryID ?? ""),
      index: request?.indexName ?? INDEX_NAME,
      nbHits,
      page: Number(result.page ?? 0),
      filters: requestFilters(request),
    });
  }, 400);
}

function wrapSearch(
  client: InstantSearchProps["searchClient"],
  mapRequest: (request: SearchRequest) => SearchRequest = (request) => request,
): InstantSearchProps["searchClient"] {
  const search = client.search.bind(client);
  return {
    ...client,
    search(input: SearchRequest[] | { requests: SearchRequest[] }, ...rest: unknown[]) {
      const original = Array.isArray(input)
        ? input
        : input && Array.isArray(input.requests)
          ? input.requests
          : [];
      const mapped = original.map(mapRequest);
      const nextInput = Array.isArray(input) ? mapped : { ...input, requests: mapped };
      const pending = search(nextInput as never, ...(rest as []));
      void Promise.resolve(pending).then((payload: { results?: Array<{ queryID?: string; nbHits?: number; page?: number }> }) => {
        logMainSearch(original[0], payload?.results?.[0]);
      });
      return pending;
    },
  } as InstantSearchProps["searchClient"];
}

function withNaturalLanguage(
  client: InstantSearchProps["searchClient"],
): InstantSearchProps["searchClient"] {
  return wrapSearch(client, rewriteRequest);
}

export const searchClient = (
  usingAlgoliaCloud
    ? withNaturalLanguage(algoliasearch(appId!, apiKey!))
    : wrapSearch(createLocalSearchClient(searchRecords as SearchRecord[]))
) as InstantSearchProps["searchClient"];
