import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { loadAlgoliaAnalytics } from "@/lib/algolia-analytics";
import { loadSearchAnalytics } from "@/lib/search-analytics-store";
import type { CountRow, SearchAnalyticsEvent } from "@/lib/search-analytics";
import { displayQuery, formatFilter } from "@/lib/search-analytics";

export const metadata: Metadata = {
  title: "Search intel",
  description:
    "Algolia Analytics for the Konoha Daily mission archive: searches, clicks, conversions, and zero results.",
};

export const dynamic = "force-dynamic";

function percent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 1000) / 10}%`;
}

function filedAt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CountList({
  rows,
  empty,
}: {
  rows: CountRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="intel-empty-note">{empty}</p>;
  }
  return (
    <ol className="intel-rank">
      {rows.map((row) => (
        <li key={row.label}>
          {row.href ? <Link href={row.href}>{row.label}</Link> : <span>{row.label}</span>}
          {row.meta ? <small>{row.meta}</small> : null}
          <b>{row.count}</b>
        </li>
      ))}
    </ol>
  );
}

function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: ReactNode;
}) {
  return (
    <article>
      <p>{label}</p>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function recentLabel(event: SearchAnalyticsEvent): string {
  if (event.type === "click") {
    return event.title || event.objectID || "Report";
  }
  return displayQuery(event.query);
}

function recentKind(event: SearchAnalyticsEvent): string {
  if (event.type === "click") return "Click";
  if (event.type === "empty") return "No hits";
  return event.query.trim() ? "Search" : "Browse";
}

export default async function IntelPage() {
  const [algolia, live] = await Promise.all([
    loadAlgoliaAnalytics(),
    loadSearchAnalytics(),
  ]);
  return (
    <main className="edition intel-page">
      <header className="page-intro">
        <p className="kicker">ANBU · Mission desk</p>
        <h1>Search intel</h1>
        <p>
          {algolia
            ? `Algolia Analytics API for konoha_daily (${algolia.region.toUpperCase()}): search, click, conversion, filter, country, revenue, and query-pattern endpoints. Insights clicks, views, and report-read conversions feed CTR and CR. Figures can lag a few minutes.`
            : "Local ledger only. Add Algolia Cloud keys and an admin key with the analytics ACL to pull the hosted Analytics API."}
        </p>
        {algolia?.updatedAt ? (
          <p className="intel-updated">
            Algolia processed through {new Date(algolia.updatedAt).toLocaleString()}.
          </p>
        ) : null}
      </header>

      {algolia ? (
        <>
          <section className="intel-kpis" aria-label="Algolia Analytics totals">
            <Kpi
              label="Searches"
              value={algolia.searches}
              note={`${algolia.users} unique users`}
            />
            <Kpi
              label="CTR"
              value={percent(algolia.clickThroughRate)}
              note={`${algolia.clickCount} clicks · ${algolia.trackedSearches} tracked`}
            />
            <Kpi
              label="Conversion"
              value={percent(algolia.conversionRate)}
              note={`${algolia.conversionCount} report reads`}
            />
            <Kpi
              label="No hits"
              value={percent(algolia.noResultRate)}
              note={`${algolia.noResultCount} empty searches`}
            />
            <Kpi
              label="No click"
              value={percent(algolia.noClickRate)}
              note={`${algolia.noClickCount} tracked with no click`}
            />
            <Kpi
              label="Avg click pos."
              value={
                algolia.averageClickPosition != null
                  ? algolia.averageClickPosition.toFixed(1)
                  : "—"
              }
            />
            <Kpi label="Users" value={algolia.users} />
            <Kpi
              label="Archive tag"
              value={algolia.archiveSearches}
              note="analyticsTags = archive"
            />
            <Kpi
              label="Live desk"
              value={live.total}
              note={<Link href="/archive">Open the archive</Link>}
            />
          </section>

          <section className="intel-kpis" aria-label="Revenue analytics">
            <Kpi
              label="Add to cart"
              value={percent(algolia.addToCartRate)}
              note={`${algolia.addToCartCount} events · no cart on this ledger`}
            />
            <Kpi
              label="Purchase"
              value={percent(algolia.purchaseRate)}
              note={`${algolia.purchaseCount} events`}
            />
            <Kpi
              label="Revenue"
              value={algolia.revenue ?? "—"}
              note="Revenue Analytics endpoint"
            />
            {algolia.queryPatternMetrics.slice(0, 5).map((metric) => (
              <Kpi
                key={metric.label}
                label={metric.label}
                value={metric.value}
                note="Query Patterns"
              />
            ))}
          </section>

          {algolia.dailySearches.length > 0 ? (
            <section className="intel-recent">
              <h2>Daily searches</h2>
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Searches</th>
                    <th>Users</th>
                    <th>Clicks</th>
                    <th>CTR</th>
                    <th>Reads</th>
                    <th>No hits</th>
                  </tr>
                </thead>
                <tbody>
                  {algolia.dailySearches.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date}</td>
                      <td>{day.searches}</td>
                      <td>{day.users}</td>
                      <td>{day.clicks}</td>
                      <td>{percent(day.ctr)}</td>
                      <td>{day.conversions}</td>
                      <td>{day.noResults}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <div className="intel-grid">
            <section>
              <h2>Top searches</h2>
              <CountList rows={algolia.topSearches} empty="No Algolia searches yet." />
            </section>
            <section>
              <h2>Highest CTR</h2>
              <CountList
                rows={algolia.highCtrSearches}
                empty="No click-through rates yet."
              />
            </section>
            <section>
              <h2>Highest conversion</h2>
              <CountList
                rows={algolia.highConversionSearches}
                empty="No conversion rates yet."
              />
            </section>
            <section>
              <h2>Query patterns</h2>
              <CountList
                rows={algolia.queryPatterns}
                empty="Query Patterns API had no grouped queries, or the catalog is unavailable."
              />
            </section>
            <section>
              <h2>Zero-result searches</h2>
              <CountList
                rows={algolia.zeroQueries}
                empty="No empty results in the Algolia window."
              />
            </section>
            <section>
              <h2>Searches with no clicks</h2>
              <CountList
                rows={algolia.noClickQueries}
                empty="No tracked searches without a click."
              />
            </section>
            <section>
              <h2>Top hits</h2>
              <CountList rows={algolia.topHits} empty="No clicked or returned hits yet." />
            </section>
            <section>
              <h2>Filters used</h2>
              <CountList rows={algolia.topFilters} empty="No filter analytics yet." />
            </section>
            <section>
              <h2>Filters with no results</h2>
              <CountList
                rows={algolia.noResultFilters}
                empty="No empty-result filter combos."
              />
            </section>
            <section>
              <h2>Click positions</h2>
              <CountList
                rows={algolia.clickPositions}
                empty="No click-position data yet."
              />
            </section>
            <section>
              <h2>Countries</h2>
              <CountList rows={algolia.countries} empty="No country breakdown yet." />
            </section>
            {algolia.filterFacets.map((facet) => (
              <section key={facet.attribute}>
                <h2>{facet.label} values</h2>
                <CountList
                  rows={facet.rows}
                  empty={`No ${facet.label.toLowerCase()} filters yet.`}
                />
              </section>
            ))}
          </div>
        </>
      ) : (
        <section className="intel-kpis" aria-label="Search totals">
          <Kpi
            label="Searches"
            value={live.searches}
            note={`${live.uniqueQueries} distinct queries`}
          />
          <Kpi label="Clicks" value={live.clicks} note={`CTR ${percent(live.ctr)}`} />
          <Kpi
            label="No hits"
            value={live.empty}
            note={`${percent(live.emptyRate)} of searches`}
          />
          <Kpi
            label="Events"
            value={live.total}
            note={<Link href="/archive">Open the archive</Link>}
          />
        </section>
      )}

      {live.total === 0 ? (
        <p className="empty-search">
          No live desk events yet. Ask the ledger, then return to this file.
        </p>
      ) : (
        <>
          {!algolia ? (
            <div className="intel-grid">
              <section>
                <h2>Top queries</h2>
                <CountList rows={live.topQueries} empty="No queries yet." />
              </section>
              <section>
                <h2>Zero-result queries</h2>
                <CountList
                  rows={live.zeroQueries}
                  empty="No empty results. The ledger is answering."
                />
              </section>
              <section>
                <h2>Clicked reports</h2>
                <CountList rows={live.topClicks} empty="No report clicks yet." />
              </section>
              <section>
                <h2>Filters used</h2>
                <CountList rows={live.topFilters} empty="No refinements logged." />
              </section>
            </div>
          ) : null}

          <section className="intel-recent">
            <h2>Live desk</h2>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kind</th>
                  <th>Detail</th>
                  <th>Hits</th>
                </tr>
              </thead>
              <tbody>
                {live.recent.map((event, index) => (
                  <tr key={`${event.ts}-${event.queryID}-${index}`}>
                    <td>{filedAt(event.ts)}</td>
                    <td>{recentKind(event)}</td>
                    <td>
                      {event.type === "click" && event.objectID ? (
                        <Link href={`/reports/${event.objectID}`}>
                          {recentLabel(event)}
                        </Link>
                      ) : (
                        recentLabel(event)
                      )}
                      {event.filters && event.filters.length > 0 ? (
                        <small>
                          {event.filters.slice(0, 3).map(formatFilter).join(" · ")}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      {event.type === "click"
                        ? event.position != null
                          ? `#${event.position + 1}`
                          : "—"
                        : (event.nbHits ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
