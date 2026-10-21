"use client";

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
  useHits,
} from "react-instantsearch";
import { InstantSearchNext } from "react-instantsearch-nextjs";
import { RankSeal } from "@/components/RankSeal";
import { formatDateline, INDEX_NAME, slugify } from "@/lib/article";
import { searchClient, usingAlgoliaCloud } from "@/lib/search-client";
import type { Rank, SearchRecord } from "@/lib/types";

function asArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  return (Array.isArray(value) ? value : [value]).map(String);
}

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

export function SearchExperience() {
  return (
    <InstantSearchNext
      future={{ preserveSharedStateOnUnmount: true }}
      indexName={INDEX_NAME}
      routing={routing}
      searchClient={searchClient}
    >
      <Configure hitsPerPage={12} maxValuesPerFacet={40} />
      <div className="archive-shell">
        <aside className="archive-filters">
          <p className="filter-label">Rank</p>
          <RefinementList
            attribute="rank"
            transformItems={(items) => {
              const order = ["S", "A", "B", "C", "D"];
              return [...items].sort(
                (a, b) => order.indexOf(a.label) - order.indexOf(b.label),
              );
            }}
          />
          <p className="filter-label">Author</p>
          <RefinementList
            attribute="author"
            searchable
            searchablePlaceholder="Find a correspondent…"
            showMore
            limit={8}
          />
          <p className="filter-label">Topic</p>
          <RefinementList
            attribute="topics"
            searchable
            searchablePlaceholder="Akatsuki, Hokage, Civic…"
            showMore
            limit={10}
          />
          <p className="filter-label">Date · Konoha year</p>
          <RefinementList
            attribute="year"
            limit={20}
            transformItems={(items) =>
              items
                .slice()
                .sort((a, b) => Number(b.label) - Number(a.label))
                .map((item) => ({ ...item, label: `Year ${item.label}` }))
            }
          />
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
              items.map((item) => ({
                ...item,
                label:
                  item.attribute === "topics"
                    ? "Topic"
                    : item.attribute === "author"
                      ? "Author"
                      : item.attribute === "year"
                        ? "Year"
                        : item.attribute === "rank"
                          ? "Rank"
                          : item.label,
              }))
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
