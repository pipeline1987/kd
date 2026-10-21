"use client";

import type { SearchAnalyticsEvent } from "@/lib/search-analytics";

const ENDPOINT = "/api/search/events";
const recent = new Map<string, number>();

const usingAlgoliaCloud = Boolean(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID &&
    process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY &&
    process.env.NEXT_PUBLIC_ALGOLIA_APP_ID !== "local" &&
    process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY !== "local",
);

function eventKey(event: SearchAnalyticsEvent): string {
  return [
    event.type,
    event.queryID,
    event.query,
    event.page ?? 0,
    event.objectID ?? "",
  ].join(":");
}

export function trackSearchEvent(
  event: Omit<SearchAnalyticsEvent, "ts" | "engine"> & { ts?: number },
) {
  if (typeof window === "undefined") return;
  const payload: SearchAnalyticsEvent = {
    ...event,
    ts: event.ts ?? Date.now(),
    engine: usingAlgoliaCloud ? "algolia" : "local",
    query: event.query.slice(0, 180),
  };

  const key = eventKey(payload);
  const last = recent.get(key);
  if (last && payload.ts - last < 2000) return;
  recent.set(key, payload.ts);

  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // Fall through to fetch.
  }

  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
