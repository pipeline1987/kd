"use client";

import { useEffect, useRef } from "react";
import { useHits, useInstantSearch } from "react-instantsearch";
import { INDEX_NAME } from "@/lib/article";
import { flattenFilters } from "@/lib/search-analytics";
import { trackSearchEvent } from "@/lib/track-search";

function urlQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function visibleQuery(indexQuery?: string, resultQuery?: string): string {
  const box = document.querySelector(
    ".archive-main .ais-SearchBox-input",
  ) as HTMLInputElement | null;
  return String(box?.value || indexQuery || urlQuery() || resultQuery || "");
}

function reportIdFromHref(href: string): string {
  try {
    const path = href.startsWith("http") ? new URL(href).pathname : href;
    return path.match(/\/reports\/([^/?#]+)/)?.[1] ?? "";
  } catch {
    return "";
  }
}

export function SearchTelemetry() {
  const { indexUiState, status } = useInstantSearch();
  const { results } = useHits();
  const latest = useRef({ indexUiState, results, status });
  latest.current = { indexUiState, results, status };

  const queryID = String(results?.queryID ?? "");
  const nbHits = Number(results?.nbHits ?? 0);
  const page = Number(results?.page ?? 0);

  useEffect(() => {
    if (status !== "idle" || !results) return;
    const timer = window.setTimeout(() => {
      const current = latest.current;
      if (current.status !== "idle" || !current.results) return;
      const query = visibleQuery(
        current.indexUiState.query,
        current.results.query,
      );
      trackSearchEvent({
        type: Number(current.results.nbHits ?? 0) === 0 ? "empty" : "search",
        query,
        queryID: String(current.results.queryID ?? ""),
        index: INDEX_NAME,
        nbHits: Number(current.results.nbHits ?? 0),
        page: Number(current.results.page ?? 0),
        filters: flattenFilters(current.indexUiState),
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [status, queryID, nbHits, page, indexUiState.query]);

  useEffect(() => {
    function onActivate(event: Event) {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || !link.closest(".ais-Hits, .archive-main, .hit")) return;
      const objectID = reportIdFromHref(link.getAttribute("href") ?? link.href);
      if (!objectID) return;
      const current = latest.current;
      trackSearchEvent({
        type: "click",
        query: visibleQuery(current.indexUiState.query, current.results?.query),
        queryID: String(current.results?.queryID ?? ""),
        index: INDEX_NAME,
        objectID,
        title: (link.textContent ?? "").replace(/\s+/g, " ").trim(),
        position: Number(
          (link.closest(".hit") as HTMLElement | null)?.dataset.position ??
            current.results?.page ??
            0,
        ),
      });
    }

    document.addEventListener("pointerdown", onActivate, true);
    document.addEventListener("click", onActivate, true);
    return () => {
      document.removeEventListener("pointerdown", onActivate, true);
      document.removeEventListener("click", onActivate, true);
    };
  }, []);

  return null;
}
