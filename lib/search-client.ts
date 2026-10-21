import { liteClient as algoliasearch } from "algoliasearch/lite";
import type { InstantSearchProps } from "react-instantsearch";
import searchRecords from "@/data/search-records.json";
import { INDEX_NAME } from "@/lib/article";
import { createLocalSearchClient } from "@/lib/local-search";
import type { SearchRecord } from "@/lib/types";

export { INDEX_NAME };

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

export const usingAlgoliaCloud = Boolean(
  appId && apiKey && appId !== "local" && apiKey !== "local",
);

export const searchClient = (
  usingAlgoliaCloud
    ? algoliasearch(appId!, apiKey!)
    : createLocalSearchClient(searchRecords as SearchRecord[])
) as InstantSearchProps["searchClient"];
