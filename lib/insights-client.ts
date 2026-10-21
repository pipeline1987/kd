"use client";

import aa from "search-insights";
import type { InsightsClient } from "instantsearch.js";
import { usingAlgoliaCloud } from "@/lib/search-client";

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

if (usingAlgoliaCloud && appId && apiKey) {
  aa("init", { appId, apiKey, useCookie: true, partial: true });
}

export const insightsClient: InsightsClient = (method, ...args) => {
  if (!usingAlgoliaCloud) {
    if (method === "getUserToken") {
      const callback = args[1] as
        | ((err: null, userToken: string) => void)
        | undefined;
      callback?.(null, "anonymous");
      return "anonymous";
    }
    return;
  }
  return aa(method, ...args);
};

insightsClient.version = aa.version ?? "2.17.2";
