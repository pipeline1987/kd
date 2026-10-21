export type SearchEventType = "search" | "empty" | "click";

export type SearchAnalyticsEvent = {
  type: SearchEventType;
  ts: number;
  query: string;
  queryID: string;
  index: string;
  engine?: "local" | "algolia";
  nbHits?: number;
  page?: number;
  filters?: string[];
  objectID?: string;
  position?: number;
  title?: string;
};

export type CountRow = {
  label: string;
  count: number;
  meta?: string;
  href?: string;
};

export type SearchAnalyticsSummary = {
  total: number;
  searches: number;
  clicks: number;
  empty: number;
  uniqueQueries: number;
  ctr: number;
  emptyRate: number;
  topQueries: CountRow[];
  zeroQueries: CountRow[];
  topClicks: CountRow[];
  topFilters: CountRow[];
  recent: SearchAnalyticsEvent[];
};

const FILTER_NAMES: Record<string, string> = {
  topics: "Category",
  author: "Author",
  year: "Year",
  month: "Month",
  rank: "Rank",
  era: "Era",
  status: "Status",
  location: "Location",
  classified: "File",
};

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function displayQuery(query: string): string {
  const normalized = normalizeQuery(query);
  return normalized.length > 0 ? normalized : "(browse)";
}

export function flattenFilters(uiState: {
  refinementList?: Record<string, string[] | undefined>;
  toggle?: Record<string, boolean | undefined>;
}): string[] {
  const filters: string[] = [];
  for (const [attribute, values] of Object.entries(uiState.refinementList ?? {})) {
    if (!values) continue;
    for (const value of values) filters.push(`${attribute}:${value}`);
  }
  for (const [attribute, on] of Object.entries(uiState.toggle ?? {})) {
    if (on) filters.push(`${attribute}:true`);
  }
  return filters;
}

export function formatFilter(filter: string): string {
  const split = filter.indexOf(":");
  if (split === -1) return filter;
  const attribute = filter.slice(0, split);
  const value = filter.slice(split + 1);
  return `${FILTER_NAMES[attribute] ?? attribute}: ${value}`;
}

function topCounts(
  values: string[],
  limit: number,
  extras?: Map<string, string>,
): CountRow[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      meta: extras?.get(label),
    }));
}

export function summarizeEvents(
  events: SearchAnalyticsEvent[],
): SearchAnalyticsSummary {
  const searches = events.filter(
    (event) => event.type === "search" || event.type === "empty",
  );
  const clicks = events.filter((event) => event.type === "click");
  const empty = events.filter((event) => event.type === "empty");

  const hitsByQuery = new Map<string, { total: number; n: number }>();
  for (const event of searches) {
    const label = displayQuery(event.query);
    const current = hitsByQuery.get(label) ?? { total: 0, n: 0 };
    current.total += event.nbHits ?? 0;
    current.n += 1;
    hitsByQuery.set(label, current);
  }
  const avgHits = new Map<string, string>();
  for (const [label, { total, n }] of hitsByQuery) {
    avgHits.set(label, `${Math.round(total / Math.max(1, n))} avg hits`);
  }

  const clickMeta = new Map<string, string>();
  const clickHrefs = new Map<string, string>();
  for (const event of clicks) {
    const label = event.title || event.objectID || "Unknown file";
    if (event.objectID) clickHrefs.set(label, `/reports/${event.objectID}`);
    if (event.query) clickMeta.set(label, displayQuery(event.query));
  }

  const topClicks = topCounts(
    clicks.map((event) => event.title || event.objectID || "Unknown file"),
    10,
    clickMeta,
  ).map((row) => ({ ...row, href: clickHrefs.get(row.label) }));

  return {
    total: events.length,
    searches: searches.length,
    clicks: clicks.length,
    empty: empty.length,
    uniqueQueries: new Set(searches.map((event) => displayQuery(event.query)))
      .size,
    ctr: searches.length === 0 ? 0 : clicks.length / searches.length,
    emptyRate: searches.length === 0 ? 0 : empty.length / searches.length,
    topQueries: topCounts(
      searches.map((event) => displayQuery(event.query)),
      10,
      avgHits,
    ),
    zeroQueries: topCounts(
      empty.map((event) => displayQuery(event.query)),
      10,
    ),
    topClicks,
    topFilters: topCounts(
      searches.flatMap((event) => (event.filters ?? []).map(formatFilter)),
      10,
    ),
    recent: events.slice(-25).reverse(),
  };
}

export function parseAnalyticsEvent(raw: unknown): SearchAnalyticsEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.type !== "search" && value.type !== "empty" && value.type !== "click") {
    return null;
  }
  const query = String(value.query ?? "").slice(0, 180);
  const queryID = String(value.queryID ?? "").slice(0, 64);
  const index = String(value.index ?? "konoha_daily").slice(0, 80);
  const ts = Number(value.ts);
  if (!Number.isFinite(ts)) return null;

  const event: SearchAnalyticsEvent = {
    type: value.type,
    ts,
    query,
    queryID,
    index,
  };

  if (value.engine === "local" || value.engine === "algolia") {
    event.engine = value.engine;
  }
  if (typeof value.nbHits === "number" && Number.isFinite(value.nbHits)) {
    event.nbHits = Math.max(0, Math.round(value.nbHits));
  }
  if (typeof value.page === "number" && Number.isFinite(value.page)) {
    event.page = Math.max(0, Math.round(value.page));
  }
  if (Array.isArray(value.filters)) {
    event.filters = value.filters.map((filter) => String(filter).slice(0, 80)).slice(0, 24);
  }
  if (typeof value.objectID === "string") {
    event.objectID = value.objectID.slice(0, 120);
  }
  if (typeof value.position === "number" && Number.isFinite(value.position)) {
    event.position = Math.max(0, Math.round(value.position));
  }
  if (typeof value.title === "string") {
    event.title = value.title.slice(0, 180);
  }
  return event;
}
