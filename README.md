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
| [tsx](https://tsx.is/) | Runs `scripts/generate-archive.ts` and `scripts/index-algolia.ts` |
| [ESLint](https://eslint.org/) (`eslint-config-next`) | Lint |
| [Narutopedia](https://naruto.fandom.com/wiki/Naruto_(series)) | Canon timeline, characters, and [mission ranks](https://naruto.fandom.com/wiki/Missions) |

Search-only work does not need an Algolia account: InstantSearch talks to a local Algolia-compatible client over `data/search-records.json`.

## Archive

Mission ranks follow the village scale recorded on [Narutopedia](https://naruto.fandom.com/wiki/Missions): D civic errands, C bandits and escorts, B expected ninja combat, A village- or state-level work, S confidential state files. Landmark dispatches cover the class of Year 64 through the Ōtsutsuki incident in Year 83. Remaining desk copy fills the twenty-year spine.

Fan work. Naruto is © Masashi Kishimoto / Shueisha / TV Tokyo / Pierrot.
