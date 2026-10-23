# Konoha Daily

A Konohagakure fan newspaper. Every article is a mission report. Twenty years of the ledger — Konoha Years 64 through 83 — searchable by topic, author, and date.

**All ranks, D to S, reported daily.**

## Run

```bash
npm install
npm run generate   # rebuilds data/articles.json from the canon landmarks + filler desk
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Search works immediately against a local Algolia-compatible index of the archive.

## Algolia

The archive UI is React InstantSearch. Without keys it uses a local search client with the same facets (topic, author, rank, Konoha year). To point it at Algolia Cloud:

1. Create an application at [Algolia](https://www.algolia.com/).
2. Copy `.env.example` to `.env.local` and fill in the app ID, search-only key, and admin key.
3. Index the ledger:

```bash
npm run index
```

Restart the dev server. The archive page will search the hosted `konoha_daily` index.

## Search analytics

Open **Search intel** in the masthead (`/intel`).

With Algolia Cloud keys, `/intel` reads the full [Analytics API](https://www.algolia.com/doc/libraries/sdk/methods/analytics) (admin key, `analytics` ACL, region `us` or `de`): search and user counts, CTR, conversion, no-result and no-click rates, average click position, click positions, top searches (including CTR and conversion orderings), top hits, zero-result queries, searches with no clicks, filter attributes and per-facet values, filters with no results, countries, archive-tagged searches, add-to-cart / purchase / revenue endpoints, and Query Patterns (`/3/patterns`). InstantSearch sends the events those metrics need:

- Searches with `clickAnalytics`, `analytics`, and the `archive` tag
- Click and view events via [Insights](https://www.algolia.com/doc/guides/sending-events/using-library/instantsearch/) (`search-insights`)
- Conversion (`Report Read`) when a hit is opened with its `queryID`

Algolia’s numbers can lag a few minutes. Add-to-cart, purchase, and revenue stay empty unless those Insights events are sent. The same page still shows a live local desk (`data/search-analytics.json`, gitignored) for the current session.

Set `ALGOLIA_ANALYTICS_REGION` in `.env` to `us` or `de` to match **Infrastructure → Analytics** in the Algolia dashboard.

## Ask the desk

Open **Ask the desk** (`/desk`). The clerk is an agent: it searches the mission archive (Algolia Cloud when keys are set, otherwise the local index), opens matching reports, and answers only from those files.

Add `OPENAI_API_KEY` for a full briefing (optional `OPENAI_BASE_URL` / `OPENAI_MODEL`). Without a model key it still retrieves reports and quotes the closest files.

## Tools

| Tool | Use |
| --- | --- |
| [Next.js](https://nextjs.org/) 16 (App Router, Turbopack) | Site framework, routing, and static mission pages |
| [React](https://react.dev/) 19 | UI |
| [TypeScript](https://www.typescriptlang.org/) | Types across the app and archive scripts |
| [Tailwind CSS](https://tailwindcss.com/) 4 | Layout utilities; ANBU theme lives in `app/globals.css` |
| [Algolia](https://www.algolia.com/) (`algoliasearch` v5) | Hosted search index (`npm run index`) |
| [React InstantSearch](https://www.algolia.com/doc/guides/building-search-ui/what-is-instantsearch/react/) | Archive search UI — topic, author, rank, and Konoha year |
| [react-instantsearch-nextjs](https://www.npmjs.com/package/react-instantsearch-nextjs) | InstantSearch on the App Router |
| [search-insights](https://www.npmjs.com/package/search-insights) | Algolia Insights clicks, views, and report-read conversions |
| [Algolia Analytics API](https://www.algolia.com/doc/libraries/sdk/methods/analytics) (`algoliasearch` `initAnalytics`) | Hosted search, click, conversion, filter, country, revenue, and Query Patterns metrics on `/intel` |
| Ask the desk (`/desk`) | Agentic briefing over the mission ledger — search + read-report tools |
| [tsx](https://tsx.is/) | Runs `scripts/generate-archive.ts` and `scripts/index-algolia.ts` |
| [ESLint](https://eslint.org/) (`eslint-config-next`) | Lint |
| [Narutopedia](https://naruto.fandom.com/wiki/Naruto_(series)) | Canon timeline, characters, and [mission ranks](https://naruto.fandom.com/wiki/Missions) |

Search-only work does not need an Algolia account: InstantSearch talks to a local Algolia-compatible client over `data/search-records.json`.

## Archive

Mission ranks follow the village scale recorded on [Narutopedia](https://naruto.fandom.com/wiki/Missions): D civic errands, C bandits and escorts, B expected ninja combat, A village- or state-level work, S confidential state files. Landmark dispatches cover the class of Year 64 through the Ōtsutsuki incident in Year 83. Remaining desk copy fills the twenty-year spine.

Fan work. Naruto is © Masashi Kishimoto / Shueisha / TV Tokyo / Pierrot.
