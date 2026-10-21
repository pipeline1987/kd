"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ClearRefinements,
  Configure,
  CurrentRefinements,
  Highlight,
  Hits,
  Pagination,
  RefinementList,
  SearchBox,
  Stats,
  ToggleRefinement,
  useHits,
} from "react-instantsearch";
import { InstantSearchNext } from "react-instantsearch-nextjs";
import { RankSeal } from "@/components/RankSeal";
import {
  ERAS,
  formatDateline,
  INDEX_NAME,
  monthName,
  slugify,
  STATUSES,
} from "@/lib/article";
import { searchClient, usingAlgoliaCloud } from "@/lib/search-client";
import type { Rank, SearchRecord } from "@/lib/types";

function asArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  return (Array.isArray(value) ? value : [value]).map(String);
}

const RANK_ORDER = ["S", "A", "B", "C", "D"];

const routing = {
  stateMapping: {
    stateToRoute(uiState: Record<string, any>) {
      const indexUiState = uiState[INDEX_NAME] ?? {};
      return {
        q: indexUiState.query || undefined,
        rank: indexUiState.refinementList?.rank,
        author: indexUiState.refinementList?.author,
        topic: indexUiState.refinementList?.topics,
        year: indexUiState.refinementList?.year,
        month: indexUiState.refinementList?.month,
        era: indexUiState.refinementList?.era,
        status: indexUiState.refinementList?.status,
        location: indexUiState.refinementList?.location,
        classified: indexUiState.toggle?.classified ? 1 : undefined,
        page: indexUiState.page > 1 ? indexUiState.page : undefined,
      };
    },
    routeToState(routeState: Record<string, any>) {
      return {
        [INDEX_NAME]: {
          query: routeState.q,
          refinementList: {
            rank: asArray(routeState.rank),
            author: asArray(routeState.author),
            topics: asArray(routeState.topic),
            year: asArray(routeState.year),
            month: asArray(routeState.month),
            era: asArray(routeState.era),
            status: asArray(routeState.status),
            location: asArray(routeState.location),
          },
          toggle: {
            classified: Boolean(routeState.classified),
          },
          page: routeState.page,
        },
      };
    },
  },
};

function Hit({ hit }: { hit: SearchRecord & { objectID: string } }) {
  return (
    <article className="hit">
      <RankSeal rank={hit.rank as Rank} size="sm" />
      <div>
        <p className="kicker">
          {hit.location} · {formatDateline(hit)} · {hit.missionId}
        </p>
        <h2>
          <Link href={`/reports/${hit.slug}`}>
            <Highlight attribute="title" hit={hit as never} />
          </Link>
        </h2>
        <p className="excerpt">
          <Highlight attribute="excerpt" hit={hit as never} />
        </p>
        <p className="byline">
          Filed by{" "}
          <Link href={`/authors/${hit.authorSlug}`}>
            <Highlight attribute="author" hit={hit as never} />
          </Link>
        </p>
        <ul className="topic-row">
          {hit.topics.slice(0, 4).map((topic) => (
            <li key={topic}>
              <Link href={`/topics/${slugify(topic)}`}>{topic}</Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function EmptyQuery() {
  const { hits, results } = useHits();
  if (hits.length > 0) return null;
  if ((results?.nbHits ?? 0) > 0) return null;
  return (
    <p className="empty-search">
      No mission reports match this query. Try a shinobi name, a village, a rank,
      or a Konoha year.
    </p>
  );
}

function sortByOrder(order: readonly string[]) {
  return (items: Array<{ label: string }>) =>
    [...items].sort((a, b) => {
      const left = order.indexOf(a.label);
      const right = order.indexOf(b.label);
      return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
    });
}

function FilterGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className="filter-group"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="filter-label">{title}</summary>
      {children}
    </details>
  );
}

export function SearchExperience() {
  return (
    <InstantSearchNext
      future={{ preserveSharedStateOnUnmount: true }}
      indexName={INDEX_NAME}
      routing={routing}
      searchClient={searchClient}
    >
      <Configure hitsPerPage={12} maxValuesPerFacet={80} />
      <div className="archive-shell">
        <aside className="archive-filters">
          <p className="filter-kicker">Narrow the ledger</p>

          <FilterGroup title="Category">
            <RefinementList
              attribute="topics"
              searchable
              searchablePlaceholder="Akatsuki, Civic, War…"
              showMore
              limit={8}
            />
          </FilterGroup>

          <FilterGroup title="Date">
            <p className="filter-sublabel">Era</p>
            <RefinementList
              attribute="era"
              transformItems={sortByOrder(ERAS)}
            />
            <p className="filter-sublabel">Konoha year</p>
            <RefinementList
              attribute="year"
              limit={8}
              showMore
              showMoreLimit={20}
              transformItems={(items) =>
                items
                  .slice()
                  .sort((a, b) => Number(b.value) - Number(a.value))
                  .map((item) => ({ ...item, label: `Year ${item.label}` }))
              }
            />
            <p className="filter-sublabel">Month</p>
            <RefinementList
              attribute="month"
              transformItems={(items) =>
                [...items]
                  .sort((a, b) => Number(a.value) - Number(b.value))
                  .map((item) => ({
                    ...item,
                    label: monthName(Number(item.value)) || item.label,
                  }))
              }
            />
          </FilterGroup>

          <FilterGroup title="Rank">
            <RefinementList
              attribute="rank"
              transformItems={sortByOrder(RANK_ORDER)}
            />
          </FilterGroup>

          <FilterGroup title="Status">
            <RefinementList
              attribute="status"
              transformItems={sortByOrder(STATUSES)}
            />
            <ToggleRefinement
              attribute="classified"
              label="Classified files only"
            />
          </FilterGroup>

          <FilterGroup title="Location" defaultOpen={false}>
            <RefinementList
              attribute="location"
              searchable
              searchablePlaceholder="Tower, Waves, Sand…"
              showMore
              limit={8}
            />
          </FilterGroup>

          <FilterGroup title="Author" defaultOpen={false}>
            <RefinementList
              attribute="author"
              searchable
              searchablePlaceholder="Find a correspondent…"
              showMore
              limit={8}
            />
          </FilterGroup>
        </aside>
        <div className="archive-main">
          <SearchBox placeholder="Search by topic, author, date, shinobi, or village…" />
          <div className="archive-meta">
            <Stats />
            <p className="search-engine">
              {usingAlgoliaCloud
                ? "Algolia Cloud"
                : "Algolia-compatible local index"}
            </p>
            <ClearRefinements
              translations={{ resetButtonText: "Clear filters" }}
            />
          </div>
          <CurrentRefinements
            transformItems={(items) =>
              items.map((item) => {
                const names: Record<string, string> = {
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
                return {
                  ...item,
                  label: names[item.attribute] ?? item.label,
                  refinements: item.refinements.map((refinement) => {
                    if (item.attribute === "month") {
                      return {
                        ...refinement,
                        label:
                          monthName(Number(refinement.value)) ||
                          refinement.label,
                      };
                    }
                    if (item.attribute === "year") {
                      return {
                        ...refinement,
                        label: `Year ${refinement.value}`,
                      };
                    }
                    if (item.attribute === "classified") {
                      return { ...refinement, label: "Classified" };
                    }
                    return refinement;
                  }),
                };
              })
            }
          />
          <EmptyQuery />
          <Hits hitComponent={Hit} />
          <Pagination showFirst showLast padding={2} />
        </div>
      </div>
    </InstantSearchNext>
  );
}
