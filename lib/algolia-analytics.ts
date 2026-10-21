import "server-only";

import { algoliasearch } from "algoliasearch";
import type { AnalyticsClient, Catalog } from "@algolia/client-analytics";
import { INDEX_NAME } from "@/lib/article";
import { getArticle } from "@/lib/articles";
import type { CountRow } from "@/lib/search-analytics";

export type DailyPoint = {
  date: string;
  searches: number;
  users: number;
  clicks: number;
  conversions: number;
  noResults: number;
  ctr: number | null;
  cr: number | null;
};

export type FilterFacet = {
  attribute: string;
  label: string;
  rows: CountRow[];
};

export type MetricChip = {
  label: string;
  value: string;
};

export type AlgoliaAnalyticsSnapshot = {
  region: "us" | "de";
  updatedAt: string | null;
  searches: number;
  users: number;
  archiveSearches: number;
  noResultRate: number;
  noResultCount: number;
  clickThroughRate: number | null;
  clickCount: number;
  trackedSearches: number;
  conversionRate: number | null;
  conversionCount: number;
  noClickRate: number | null;
  noClickCount: number;
  averageClickPosition: number | null;
  addToCartRate: number | null;
  addToCartCount: number;
  purchaseRate: number | null;
  purchaseCount: number;
  revenue: string | null;
  dailySearches: DailyPoint[];
  topSearches: CountRow[];
  highCtrSearches: CountRow[];
  highConversionSearches: CountRow[];
  zeroQueries: CountRow[];
  noClickQueries: CountRow[];
  topHits: CountRow[];
  topFilters: CountRow[];
  filterFacets: FilterFacet[];
  noResultFilters: CountRow[];
  clickPositions: CountRow[];
  countries: CountRow[];
  queryPatterns: CountRow[];
  queryPatternMetrics: MetricChip[];
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

const FILTER_FACETS = [
  "topics",
  "rank",
  "author",
  "era",
  "status",
  "location",
  "year",
  "month",
  "classified",
] as const;

const PATTERN_LABELS: Record<string, string> = {
  searchesCount: "Pattern searches",
  clickThroughRate: "Pattern CTR",
  conversionRate: "Pattern CR",
  noResultsRate: "Pattern no-hit",
  trackedUserCount: "Pattern users",
  usersCount: "Pattern users",
};

const CACHE_MS = 60_000;
let cache: { expires: number; value: AlgoliaAnalyticsSnapshot | null } | null =
  null;

function cloudReady() {
  const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
  const adminKey = process.env.ALGOLIA_ADMIN_KEY;
  return Boolean(appId && adminKey && appId !== "local");
}

function isTooMany(error: unknown): boolean {
  const err = error as { status?: number; message?: string };
  return err.status === 429 || /too many requests/i.test(err.message ?? "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settled<T>(run: () => Promise<T>): Promise<T | null> {
  let delay = 400;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isTooMany(error) || attempt === 3) return null;
      await sleep(delay);
      delay = Math.min(delay * 2, 2500);
    }
  }
  return null;
}

async function pool<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

function list<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function rateLabel(rate: number | null | undefined): string | undefined {
  if (rate == null || Number.isNaN(rate)) return undefined;
  return `${(rate * 100).toFixed(1)}%`;
}

function formatRevenue(
  currencies:
    | Record<string, { currency?: string; revenue?: number }>
    | null
    | undefined,
): string | null {
  if (!currencies) return null;
  const parts = Object.entries(currencies)
    .filter(([, value]) => value?.revenue != null)
    .map(
      ([code, value]) => `${value.revenue} ${value.currency ?? code}`.trim(),
    );
  return parts.length > 0 ? parts.join(" · ") : null;
}

async function clientForRegion(region: "us" | "de"): Promise<AnalyticsClient> {
  const search = algoliasearch(
    process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
    process.env.ALGOLIA_ADMIN_KEY!,
  );
  return search.initAnalytics({ region });
}

async function connectAnalytics(): Promise<{
  client: AnalyticsClient;
  region: "us" | "de";
} | null> {
  if (!cloudReady()) return null;
  const preferred =
    process.env.ALGOLIA_ANALYTICS_REGION === "de" ? "de" : "us";
  const fallback = preferred === "us" ? "de" : "us";
  for (const region of [preferred, fallback] as const) {
    const client = await clientForRegion(region);
    try {
      await client.getStatus({ index: INDEX_NAME });
      return { client, region };
    } catch (error) {
      if (isTooMany(error)) return { client, region };
    }
  }
  return null;
}

function formatPosition(range: number[] | undefined): string {
  if (!range || range.length === 0) return "Unknown";
  const start = range[0]! + 1;
  const end = range[1];
  if (end == null || end < 0 || end === range[0]) return `#${start}`;
  return `#${start}–${end + 1}`;
}

function searchLabel(search: string | undefined): string {
  return search?.trim() ? search : "(browse)";
}

type SearchMetricRow = {
  search?: string;
  count: number;
  nbHits?: number;
  clickThroughRate?: number | null;
  conversionRate?: number | null;
  clickCount?: number;
  conversionCount?: number;
  averageClickPosition?: number | null;
};

function mapSearches(rows: SearchMetricRow[] | null | undefined): CountRow[] {
  return list(rows).map((row) => {
    const bits = [
      rateLabel(row.clickThroughRate)
        ? `CTR ${rateLabel(row.clickThroughRate)}`
        : "",
      rateLabel(row.conversionRate) ? `CR ${rateLabel(row.conversionRate)}` : "",
      row.averageClickPosition != null
        ? `avg pos ${row.averageClickPosition.toFixed(1)}`
        : "",
      row.nbHits != null && row.clickThroughRate == null
        ? `${row.nbHits} avg hits`
        : "",
    ].filter(Boolean);
    return {
      label: searchLabel(row.search),
      count: row.count,
      meta: bits.length ? bits.join(" · ") : undefined,
    };
  });
}

type HitMetricRow = {
  hit: string;
  count: number;
  clickCount?: number;
  conversionCount?: number;
  clickThroughRate?: number | null;
  conversionRate?: number | null;
};

function mapHits(rows: HitMetricRow[] | null | undefined): CountRow[] {
  return list(rows).map((row) => {
    const bits = [
      row.clickCount != null ? `${row.clickCount} clicks` : "",
      row.conversionCount != null ? `${row.conversionCount} reads` : "",
      rateLabel(row.clickThroughRate)
        ? `CTR ${rateLabel(row.clickThroughRate)}`
        : "",
      rateLabel(row.conversionRate) ? `CR ${rateLabel(row.conversionRate)}` : "",
    ].filter(Boolean);
    return {
      label: getArticle(row.hit)?.title ?? row.hit,
      count: row.count,
      href: `/reports/${row.hit}`,
      meta: bits.length ? bits.join(" · ") : undefined,
    };
  });
}

function kindsInDomain(
  catalog: Catalog | null,
  domain: string,
  slot: "metrics" | "filters" | "groups" | "distributions",
): Set<string> {
  return new Set(
    (catalog?.domains?.[domain]?.[slot] ?? []).map((entry) => entry.kind),
  );
}

function firstKind(available: Set<string>, candidates: string[]): string | null {
  return candidates.find((kind) => available.has(kind)) ?? null;
}

function patternParameters(index: string) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return [
    { kind: "indices", value: [index] },
    { kind: "startDate", value: iso(start) },
    { kind: "endDate", value: iso(end) },
  ];
}

function formatPatternValue(kind: string, value: unknown): string {
  if (typeof value === "number") {
    if (/rate|ratio/i.test(kind) && value <= 1) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (value == null) return "—";
  return String(value);
}

function mapPatternRows(
  rows: Array<Record<string, unknown>> | undefined,
): CountRow[] {
  return list(rows)
    .slice(0, 10)
    .map((row) => {
      const label = String(
        row.query ?? row.search ?? row.q ?? row.kind ?? "",
      ).slice(0, 80);
      const count = Number(
        row.searchesCount ?? row.searchCount ?? row.count ?? row.searches ?? 0,
      );
      const ctr = row.clickThroughRate ?? row.ctr;
      return {
        label: searchLabel(label),
        count: Number.isFinite(count) ? count : 0,
        meta:
          typeof ctr === "number" ? `CTR ${(ctr * 100).toFixed(1)}%` : undefined,
      };
    });
}

async function loadQueryPatterns(
  client: AnalyticsClient,
  index: string,
): Promise<{ rows: CountRow[]; metrics: MetricChip[] }> {
  try {
    const catalog = await settled(() => client.getPatternsFields());
    const metrics = kindsInDomain(catalog, "core", "metrics");
    const groups = kindsInDomain(catalog, "core", "groups");
    const distributions = kindsInDomain(catalog, "core", "distributions");
    if (metrics.size === 0) return { rows: [], metrics: [] };

    const searchCount = firstKind(metrics, ["searchesCount", "searchCount"]);
    const ctr = firstKind(metrics, ["clickThroughRate"]);
    const cr = firstKind(metrics, ["conversionRate"]);
    const noResult = firstKind(metrics, ["noResultsRate", "noResultRate"]);
    const users = firstKind(metrics, ["trackedUserCount", "usersCount"]);
    const queryKind = firstKind(groups, ["query", "rawQuery"]);
    const clickPos = firstKind(distributions, ["clickPosition"]);
    const parameters = patternParameters(index);
    const scalarMetrics = [searchCount, ctr, cr, noResult, users]
      .filter((kind): kind is string => Boolean(kind))
      .map((kind) => ({ kind }));

    const [scalar, table] = await pool(
      [
        () =>
          scalarMetrics.length
            ? settled(() =>
                client.queryPatternsScalar({
                  index,
                  scalarPayload: {
                    domain: "core",
                    metrics: scalarMetrics,
                    parameters,
                  },
                }),
              )
            : Promise.resolve(null),
        () =>
          searchCount && queryKind
            ? settled(() =>
                client.queryPatternsTable({
                  index,
                  tablePayload: {
                    domain: "core",
                    metrics: [
                      { kind: searchCount },
                      ...(ctr ? [{ kind: ctr }] : []),
                    ],
                    groupBy: [{ kind: queryKind }],
                    orderBy: [{ kind: searchCount, direction: "desc" }],
                    parameters,
                    limit: 10,
                  },
                }),
              )
            : Promise.resolve(null),
        () =>
          searchCount
            ? settled(() =>
                client.queryPatternsTimeseries({
                  index,
                  timeseriesPayload: {
                    domain: "core",
                    metrics: [{ kind: searchCount }],
                    parameters,
                  },
                }),
              )
            : Promise.resolve(null),
        () =>
          clickPos
            ? settled(() =>
                client.queryPatternsDistribution({
                  index,
                  distributionPayload: {
                    domain: "core",
                    distributions: [
                      { kind: clickPos, bins: [1, 2, 3, 4, 5, 6, 11, 21] },
                    ],
                    parameters,
                  },
                }),
              )
            : Promise.resolve(null),
      ],
      2,
      (run) => run(),
    );

    const scalarRecord = asRecord(scalar);
    const chips: MetricChip[] = scalarRecord
      ? Object.entries(scalarRecord)
          .filter(([key]) => key !== "parameters")
          .map(([kind, value]) => ({
            label: PATTERN_LABELS[kind] ?? kind,
            value: formatPatternValue(kind, value),
          }))
      : [];

    return {
      rows: mapPatternRows(
        table && "rows" in table
          ? (table.rows as Array<Record<string, unknown>>)
          : undefined,
      ),
      metrics: chips,
    };
  } catch {
    return { rows: [], metrics: [] };
  }
}

function mergeDaily(parts: {
  searches?: Array<{ date: string; count: number }> | null;
  users?: Array<{ date: string; count: number }> | null;
  clicks?: Array<{
    date: string;
    clickCount?: number;
    rate?: number | null;
  }> | null;
  conversions?: Array<{
    date: string;
    conversionCount?: number;
    rate?: number | null;
  }> | null;
  noResults?: Array<{
    date: string;
    noResultCount?: number;
  }> | null;
}): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  const row = (date: string) => {
    const current = map.get(date) ?? {
      date,
      searches: 0,
      users: 0,
      clicks: 0,
      conversions: 0,
      noResults: 0,
      ctr: null,
      cr: null,
    };
    map.set(date, current);
    return current;
  };
  for (const day of list(parts.searches)) row(day.date).searches = day.count;
  for (const day of list(parts.users)) row(day.date).users = day.count;
  for (const day of list(parts.clicks)) {
    const current = row(day.date);
    current.clicks = day.clickCount ?? 0;
    current.ctr = day.rate ?? null;
  }
  for (const day of list(parts.conversions)) {
    const current = row(day.date);
    current.conversions = day.conversionCount ?? 0;
    current.cr = day.rate ?? null;
  }
  for (const day of list(parts.noResults)) {
    row(day.date).noResults = day.noResultCount ?? 0;
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function loadAlgoliaAnalytics(): Promise<AlgoliaAnalyticsSnapshot | null> {
  if (cache && cache.expires > Date.now()) return cache.value;
  const connected = await connectAnalytics();
  if (!connected) {
    cache = { expires: Date.now() + 15_000, value: null };
    return null;
  }
  try {
    const value = await collectAnalytics(connected.client, connected.region);
    cache = { expires: Date.now() + CACHE_MS, value };
    return value;
  } catch (error) {
    console.error("Algolia Analytics collect failed", error);
    cache = { expires: Date.now() + 15_000, value: null };
    return null;
  }
}

async function collectAnalytics(
  client: AnalyticsClient,
  region: "us" | "de",
): Promise<AlgoliaAnalyticsSnapshot> {
  const index = INDEX_NAME;
  const limit = 10;
  const clickAnalytics = true;
  const tags = "archive";

  const tasks: Array<() => Promise<unknown>> = [
    () => settled(() => client.getStatus({ index })),
    () => settled(() => client.getSearchesCount({ index })),
    () => settled(() => client.getSearchesCount({ index, tags })),
    () => settled(() => client.getUsersCount({ index })),
    () => settled(() => client.getNoResultsRate({ index })),
    () => settled(() => client.getClickThroughRate({ index })),
    () => settled(() => client.getConversionRate({ index })),
    () => settled(() => client.getNoClickRate({ index })),
    () => settled(() => client.getAverageClickPosition({ index })),
    () => settled(() => client.getClickPositions({ index })),
    () => settled(() => client.getTopSearches({ index, clickAnalytics, limit })),
    () =>
      settled(() =>
        client.getTopSearches({
          index,
          clickAnalytics,
          limit,
          orderBy: "clickThroughRate",
        }),
      ),
    () =>
      settled(() =>
        client.getTopSearches({
          index,
          clickAnalytics,
          limit,
          orderBy: "conversionRate",
        }),
      ),
    () => settled(() => client.getSearchesNoResults({ index, limit })),
    () => settled(() => client.getSearchesNoClicks({ index, limit })),
    () => settled(() => client.getTopHits({ index, clickAnalytics, limit })),
    () => settled(() => client.getTopFilterAttributes({ index, limit })),
    () => settled(() => client.getTopFiltersNoResults({ index, limit })),
    () => settled(() => client.getTopCountries({ index, limit })),
    () => settled(() => client.getAddToCartRate({ index })),
    () => settled(() => client.getPurchaseRate({ index })),
    () => settled(() => client.getRevenue({ index })),
    ...FILTER_FACETS.map(
      (attribute) => () =>
        settled(() =>
          client.getTopFilterForAttribute({ attribute, index, limit }),
        ),
    ),
  ];

  const results = await pool(tasks, 3, (run) => run());
  const queryPatterns = await loadQueryPatterns(client, index);

  const [
    status,
    searchesCount,
    archiveSearches,
    usersCount,
    noResultsRate,
    clickThroughRate,
    conversionRate,
    noClickRate,
    averageClick,
    clickPositions,
    topSearches,
    highCtr,
    highConversion,
    noResults,
    noClicks,
    topHits,
    topFilters,
    noResultFilters,
    countries,
    addToCart,
    purchase,
    revenue,
    ...facetResponses
  ] = results as [
    Awaited<ReturnType<typeof client.getStatus>> | null,
    Awaited<ReturnType<typeof client.getSearchesCount>> | null,
    Awaited<ReturnType<typeof client.getSearchesCount>> | null,
    Awaited<ReturnType<typeof client.getUsersCount>> | null,
    Awaited<ReturnType<typeof client.getNoResultsRate>> | null,
    Awaited<ReturnType<typeof client.getClickThroughRate>> | null,
    Awaited<ReturnType<typeof client.getConversionRate>> | null,
    Awaited<ReturnType<typeof client.getNoClickRate>> | null,
    Awaited<ReturnType<typeof client.getAverageClickPosition>> | null,
    Awaited<ReturnType<typeof client.getClickPositions>> | null,
    Awaited<ReturnType<typeof client.getTopSearches>> | null,
    Awaited<ReturnType<typeof client.getTopSearches>> | null,
    Awaited<ReturnType<typeof client.getTopSearches>> | null,
    Awaited<ReturnType<typeof client.getSearchesNoResults>> | null,
    Awaited<ReturnType<typeof client.getSearchesNoClicks>> | null,
    Awaited<ReturnType<typeof client.getTopHits>> | null,
    Awaited<ReturnType<typeof client.getTopFilterAttributes>> | null,
    Awaited<ReturnType<typeof client.getTopFiltersNoResults>> | null,
    Awaited<ReturnType<typeof client.getTopCountries>> | null,
    Awaited<ReturnType<typeof client.getAddToCartRate>> | null,
    Awaited<ReturnType<typeof client.getPurchaseRate>> | null,
    Awaited<ReturnType<typeof client.getRevenue>> | null,
    ...(Array<Awaited<ReturnType<typeof client.getTopFilterForAttribute>> | null>),
  ];

  const filterFacets: FilterFacet[] = FILTER_FACETS.map((attribute, i) => {
    const response = facetResponses[i];
    const rows = list(
      response && "values" in response ? response.values : null,
    ).map((row) => ({
      label: `${row.value}`,
      count: row.count,
      meta: `${FILTER_NAMES[row.attribute] ?? row.attribute}${row.operator}${row.value}`,
    }));
    return {
      attribute,
      label: FILTER_NAMES[attribute] ?? attribute,
      rows,
    };
  }).filter((facet) => facet.rows.length > 0);

  return {
    region,
    updatedAt: status?.updatedAt ?? null,
    searches: searchesCount?.count ?? 0,
    users: usersCount?.count ?? 0,
    archiveSearches: archiveSearches?.count ?? 0,
    noResultRate: noResultsRate?.rate ?? 0,
    noResultCount: noResultsRate?.noResultCount ?? 0,
    clickThroughRate: clickThroughRate?.rate ?? null,
    clickCount: clickThroughRate?.clickCount ?? 0,
    trackedSearches: clickThroughRate?.trackedSearchCount ?? 0,
    conversionRate: conversionRate?.rate ?? null,
    conversionCount: conversionRate?.conversionCount ?? 0,
    noClickRate: noClickRate?.rate ?? null,
    noClickCount: noClickRate?.noClickCount ?? 0,
    averageClickPosition: averageClick?.average ?? null,
    addToCartRate: addToCart?.rate ?? null,
    addToCartCount: addToCart?.addToCartCount ?? 0,
    purchaseRate: purchase?.rate ?? null,
    purchaseCount: purchase?.purchaseCount ?? 0,
    revenue: formatRevenue(revenue?.currencies),
    dailySearches: mergeDaily({
      searches: searchesCount?.dates,
      users: usersCount?.dates,
      clicks: clickThroughRate?.dates,
      conversions: conversionRate?.dates,
      noResults: noResultsRate?.dates,
    }),
    topSearches: mapSearches(
      topSearches && "searches" in topSearches ? topSearches.searches : null,
    ),
    highCtrSearches: mapSearches(
      highCtr && "searches" in highCtr ? highCtr.searches : null,
    ),
    highConversionSearches: mapSearches(
      highConversion && "searches" in highConversion
        ? highConversion.searches
        : null,
    ),
    zeroQueries: list(
      noResults && "searches" in noResults ? noResults.searches : null,
    ).map((row) => ({
      label: searchLabel(row.search),
      count: row.count,
      meta:
        "withFilterCount" in row && row.withFilterCount
          ? `${row.withFilterCount} with filters`
          : undefined,
    })),
    noClickQueries: list(
      noClicks && "searches" in noClicks ? noClicks.searches : null,
    ).map((row) => ({
      label: searchLabel(row.search),
      count: row.count,
      meta: `${row.nbHits} hits`,
    })),
    topHits: mapHits(topHits && "hits" in topHits ? topHits.hits : null),
    topFilters: list(
      topFilters && "attributes" in topFilters ? topFilters.attributes : null,
    ).map((row) => ({
      label: FILTER_NAMES[row.attribute] ?? row.attribute,
      count: row.count,
    })),
    filterFacets,
    noResultFilters: list(
      noResultFilters && "values" in noResultFilters
        ? noResultFilters.values
        : null,
    ).flatMap((row) =>
      row.values
        ? [
            {
              label: row.values
                .map(
                  (filter) =>
                    `${FILTER_NAMES[filter.attribute] ?? filter.attribute}${filter.operator}${filter.value}`,
                )
                .join(" · "),
              count: row.count,
            },
          ]
        : [],
    ),
    clickPositions: list(
      clickPositions && "positions" in clickPositions
        ? clickPositions.positions
        : null,
    ).map((row) => ({
      label: formatPosition(row.position),
      count: row.clickCount ?? 0,
    })),
    countries: list(
      countries && "countries" in countries ? countries.countries : null,
    ).map((row) => ({
      label: row.country,
      count: row.count,
    })),
    queryPatterns: queryPatterns.rows,
    queryPatternMetrics: queryPatterns.metrics,
  };
}
