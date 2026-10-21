import { liteClient as algoliasearch } from "algoliasearch/lite";
import type { InstantSearchProps } from "react-instantsearch";
import searchRecords from "@/data/search-records.json";
import { INDEX_NAME } from "@/lib/article";
import { createLocalSearchClient } from "@/lib/local-search";
import { rewriteForKeywordEngine } from "@/lib/natural-query";
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

function withNaturalLanguage(
  client: InstantSearchProps["searchClient"],
): InstantSearchProps["searchClient"] {
  const search = client.search.bind(client);
  return {
    ...client,
    search(input: SearchRequest[] | { requests: SearchRequest[] }, ...rest: unknown[]) {
      if (Array.isArray(input)) {
        return search(input.map(rewriteRequest), ...(rest as []));
      }
      if (input && Array.isArray(input.requests)) {
        return search(
          { ...input, requests: input.requests.map(rewriteRequest) },
          ...(rest as []),
        );
      }
      return search(input as never, ...(rest as []));
    },
  } as InstantSearchProps["searchClient"];
}

export const searchClient = (
  usingAlgoliaCloud
    ? withNaturalLanguage(algoliasearch(appId!, apiKey!))
    : createLocalSearchClient(searchRecords as SearchRecord[])
) as InstantSearchProps["searchClient"];
