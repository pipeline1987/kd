import type { SearchRecord } from "./types";

export const SYNONYM_GROUPS: string[][] = [
  ["chunin", "chuunin"],
  ["jonin", "jounin"],
  ["jinchuriki", "jinchuuriki"],
  ["hyuga", "hyuuga"],
  ["choji", "chouji"],
  ["konoha", "konohagakure"],
  ["suna", "sunagakure"],
  ["kiri", "kirigakure"],
  ["iwa", "iwagakure"],
  ["kumo", "kumogakure"],
  ["bijuu", "biju"],
];

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "at",
  "for",
  "from",
  "by",
  "with",
  "as",
  "is",
  "was",
  "are",
  "be",
  "it",
  "this",
  "that",
  "not",
  "no",
  "into",
  "over",
  "after",
  "before",
  "than",
]);

const WEIGHTS = {
  title: { exact: 16, synonym: 14, prefix: 11, typo: 8 },
  topics: { exact: 13, synonym: 11, prefix: 8, typo: 6 },
  author: { exact: 12, synonym: 10, prefix: 8, typo: 6 },
  location: { exact: 9, synonym: 7, prefix: 6, typo: 4 },
  missionId: { exact: 10, synonym: 0, prefix: 5, typo: 0 },
  year: { exact: 10, synonym: 0, prefix: 0, typo: 0 },
  excerpt: { exact: 3, synonym: 2, prefix: 2, typo: 1 },
  body: { exact: 2, synonym: 1, prefix: 1, typo: 1 },
} as const;

type FieldName = keyof typeof WEIGHTS;
type MatchKind = "exact" | "synonym" | "prefix" | "typo";

const SEARCH_FIELDS: FieldName[] = [
  "title",
  "topics",
  "author",
  "location",
  "missionId",
  "year",
  "excerpt",
  "body",
];

const KIND_RANK: Record<MatchKind, number> = {
  exact: 4,
  synonym: 3,
  prefix: 2,
  typo: 1,
};

const synonymOf = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    synonymOf.set(word, group);
  }
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  if (!text) return [];
  return normalize(text)
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function tokenizeQuery(query: string): string[] {
  const tokens = tokenize(query).filter((token) => token.length > 1);
  const meaningful = tokens.filter((token) => !STOPWORDS.has(token));
  return meaningful.length ? meaningful : tokens;
}

export function allowedTypos(wordLength: number): number {
  if (wordLength < 4) return 0;
  if (wordLength < 8) return 1;
  return 2;
}

export function damerauLevenshtein(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > max) return max + 1;

  const prevPrev = new Array<number>(n + 1);
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let dist = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dist = Math.min(dist, prevPrev[j - 2] + 1);
      }
      curr[j] = dist;
      rowMin = Math.min(rowMin, dist);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= n; j++) {
      prevPrev[j] = prev[j];
      prev[j] = curr[j];
    }
  }
  return prev[n];
}

export function matchKind(
  queryToken: string,
  fieldToken: string,
  allowPrefix: boolean,
  allowTypo = true,
): MatchKind | "none" {
  if (queryToken === fieldToken) return "exact";
  const group = synonymOf.get(queryToken);
  if (group?.includes(fieldToken)) return "synonym";
  if (
    allowPrefix &&
    queryToken.length >= 3 &&
    fieldToken.length > queryToken.length &&
    fieldToken.startsWith(queryToken)
  ) {
    return "prefix";
  }
  if (!allowTypo) return "none";
  if (queryToken[0] !== fieldToken[0]) return "none";
  const max = allowedTypos(queryToken.length);
  if (max > 0 && damerauLevenshtein(queryToken, fieldToken, max) <= max) {
    return "typo";
  }
  return "none";
}

type TokenMatch = {
  kind: MatchKind;
  field: FieldName;
  token: string;
};

export type IndexedRecord = {
  record: SearchRecord;
  fields: Record<FieldName, string[]>;
};

export type PreparedIndex = {
  records: IndexedRecord[];
  idf: Map<string, number>;
  df: Map<string, number>;
};

const RARE_TOKEN_DF = 20;

function allowTypo(
  field: FieldName,
  fieldToken: string,
  df: Map<string, number>,
): boolean {
  if (field === "missionId" || field === "year") return false;
  if (field === "excerpt" || field === "body") {
    return (df.get(fieldToken) ?? 0) <= RARE_TOKEN_DF;
  }
  return true;
}

export function prepareIndex(records: SearchRecord[]): PreparedIndex {
  const indexed: IndexedRecord[] = records.map((record) => ({
    record,
    fields: {
      title: tokenize(record.title),
      topics: tokenize(record.topics.join(" ")),
      author: tokenize(record.author),
      location: tokenize(record.location),
      missionId: tokenize(record.missionId),
      year: [String(record.year)],
      excerpt: tokenize(record.excerpt),
      body: tokenize(record.body ?? ""),
    },
  }));

  const df = new Map<string, number>();
  for (const item of indexed) {
    const unique = new Set<string>();
    for (const field of SEARCH_FIELDS) {
      for (const token of item.fields[field]) unique.add(token);
    }
    for (const token of unique) df.set(token, (df.get(token) ?? 0) + 1);
  }

  const n = Math.max(1, indexed.length);
  const idf = new Map<string, number>();
  for (const [token, count] of df) {
    idf.set(token, Math.log(1 + n / count));
  }

  return { records: indexed, idf, df };
}

function bestTokenMatch(
  item: IndexedRecord,
  queryToken: string,
  allowPrefix: boolean,
  df: Map<string, number>,
): TokenMatch | null {
  let best: TokenMatch | null = null;
  for (const field of SEARCH_FIELDS) {
    for (const token of item.fields[field]) {
      const kind = matchKind(
        queryToken,
        token,
        allowPrefix,
        allowTypo(field, token, df),
      );
      if (kind === "none") continue;
      if (
        !best ||
        KIND_RANK[kind] > KIND_RANK[best.kind] ||
        (kind === best.kind &&
          WEIGHTS[field][kind] > WEIGHTS[best.field][best.kind])
      ) {
        best = { kind, field, token };
      }
      if (best.kind === "exact" && best.field === "title") return best;
    }
  }
  return best;
}

export type ScoredHit = {
  record: SearchRecord;
  score: number;
  matched: number;
};

export function scoreRecord(
  item: IndexedRecord,
  queryTokens: string[],
  idf: Map<string, number>,
  df: Map<string, number>,
): ScoredHit {
  let score = 0;
  let matched = 0;
  const last = queryTokens[queryTokens.length - 1];

  for (const token of queryTokens) {
    const hit = bestTokenMatch(item, token, token === last, df);
    if (!hit) continue;
    matched += 1;
    const rarity = idf.get(hit.token) ?? 1;
    score += WEIGHTS[hit.field][hit.kind] * rarity;
    if (hit.field === "title" && (hit.kind === "exact" || hit.kind === "synonym")) {
      score += 4;
    }
  }

  if (item.record.featured) score += 6;
  score += item.record.publishedAt / 1_000_000_000_000;

  return { record: item.record, score, matched };
}

export function rankRecords(
  index: PreparedIndex,
  queryTokens: string[],
): SearchRecord[] {
  if (!queryTokens.length) {
    return index.records.map((item) => item.record);
  }

  const scored = index.records.map((item) =>
    scoreRecord(item, queryTokens, index.idf, index.df),
  );

  const required = queryTokens.length;
  let hits = scored.filter((hit) => hit.matched >= required);
  if (!hits.length) {
    const relaxed = Math.max(1, required - 1);
    hits = scored.filter((hit) => hit.matched >= relaxed);
  }

  hits.sort(
    (a, b) => b.score - a.score || b.record.publishedAt - a.record.publishedAt,
  );
  return hits.map((hit) => hit.record);
}

export function highlight(
  text: string,
  queryTokens: string[],
  pre: string,
  post: string,
): { value: string; matchLevel: "none" | "partial" | "full" } {
  if (!queryTokens.length) return { value: text, matchLevel: "none" };
  const last = queryTokens[queryTokens.length - 1];
  const matchedTokens = new Set<string>();
  const value = text.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const token = normalize(word);
    if (!token) return word;
    const hit = queryTokens.find(
      (queryToken) =>
        matchKind(queryToken, token, queryToken === last) !== "none",
    );
    if (!hit) return word;
    matchedTokens.add(hit);
    return `${pre}${word}${post}`;
  });
  return {
    value,
    matchLevel:
      matchedTokens.size === 0
        ? "none"
        : matchedTokens.size >= queryTokens.length
          ? "full"
          : "partial",
  };
}

export function facetValueMatches(value: string, query: string): boolean {
  const queryTokens = tokenizeQuery(query);
  if (!queryTokens.length) return true;
  const fieldTokens = tokenize(value);
  if (!fieldTokens.length) return false;
  const last = queryTokens[queryTokens.length - 1];
  return queryTokens.every((queryToken) =>
    fieldTokens.some(
      (token) => matchKind(queryToken, token, queryToken === last) !== "none",
    ),
  );
}
