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
  vector: Map<string, number>;
  norm: number;
};

export type PreparedIndex = {
  records: IndexedRecord[];
  idf: Map<string, number>;
  df: Map<string, number>;
};

export type SemanticQuery = {
  tokens: string[];
  termWeights: Map<string, number>;
  natural: boolean;
  preferRank?: string;
  preferYears?: number[];
  preferMonths?: number[];
  preferEras?: string[];
  preferStatus?: string;
  preferClassified?: boolean;
  preferAuthor?: string;
  preferLocation?: string;
  preferTopics?: string[];
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

function addTf(tf: Map<string, number>, tokens: string[], weight: number) {
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + weight);
  }
}

function buildVector(
  fields: Record<FieldName, string[]>,
  record: SearchRecord,
  idf: Map<string, number>,
): { vector: Map<string, number>; norm: number } {
  const tf = new Map<string, number>();
  addTf(tf, fields.title, 5);
  addTf(tf, fields.topics, 4);
  addTf(tf, fields.author, 2);
  addTf(tf, fields.location, 2);
  addTf(tf, fields.excerpt, 2);
  addTf(tf, fields.body, 1);
  addTf(tf, fields.year, 1);
  addTf(tf, tokenize(record.era), 2);
  addTf(tf, tokenize(record.status), 1);

  const vector = new Map<string, number>();
  let sumSq = 0;
  for (const [term, count] of tf) {
    const value = (1 + Math.log(count)) * (idf.get(term) ?? 1);
    vector.set(term, value);
    sumSq += value * value;
  }
  return { vector, norm: Math.sqrt(sumSq) || 1 };
}

function cosine(
  query: Map<string, number>,
  queryNorm: number,
  doc: IndexedRecord,
): number {
  if (!query.size || !doc.vector.size) return 0;
  let dot = 0;
  const [small, large] =
    query.size < doc.vector.size
      ? [query, doc.vector]
      : [doc.vector, query];
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other) dot += weight * other;
  }
  return dot / (queryNorm * doc.norm);
}

function queryVector(
  termWeights: Map<string, number>,
  idf: Map<string, number>,
): { vector: Map<string, number>; norm: number } {
  const vector = new Map<string, number>();
  let sumSq = 0;
  for (const [term, tf] of termWeights) {
    const value = (1 + Math.log(1 + tf)) * (idf.get(term) ?? 1.2);
    vector.set(term, value);
    sumSq += value * value;
  }
  return { vector, norm: Math.sqrt(sumSq) || 1 };
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
    vector: new Map(),
    norm: 1,
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

  for (const item of indexed) {
    const built = buildVector(item.fields, item.record, idf);
    item.vector = built.vector;
    item.norm = built.norm;
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
  cosine: number;
};

function intentBoost(item: IndexedRecord, query: SemanticQuery): number {
  let boost = 0;
  const { record } = item;
  if (query.preferRank && record.rank === query.preferRank) boost += 22;
  if (query.preferYears?.includes(record.year)) boost += 18;
  if (query.preferMonths?.includes(record.month)) boost += 10;
  if (query.preferEras?.includes(record.era)) boost += 16;
  if (query.preferStatus && record.status === query.preferStatus) boost += 14;
  if (query.preferClassified && record.classified) boost += 12;
  if (
    query.preferAuthor &&
    record.author.toLowerCase().includes(query.preferAuthor.toLowerCase())
  ) {
    boost += 16;
  }
  if (
    query.preferLocation &&
    record.location.toLowerCase().includes(query.preferLocation.toLowerCase())
  ) {
    boost += 12;
  }
  if (query.preferTopics?.length) {
    const hay = record.topics.map((topic) => topic.toLowerCase());
    if (
      query.preferTopics.some((topic) =>
        hay.some((entry) => entry.includes(topic.toLowerCase())),
      )
    ) {
      boost += 14;
    }
  }
  return boost;
}

export function scoreRecord(
  item: IndexedRecord,
  queryTokens: string[],
  idf: Map<string, number>,
  df: Map<string, number>,
  cosineScore = 0,
  query?: SemanticQuery,
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

  if (query?.natural) score *= 0.4;
  const semanticScale = query?.natural ? 52 : 14;
  score += cosineScore * semanticScale;
  if (query) score += intentBoost(item, query);
  if (item.record.featured) score += 6;
  score += item.record.publishedAt / 1_000_000_000_000;

  return { record: item.record, score, matched, cosine: cosineScore };
}

export function rankRecords(
  index: PreparedIndex,
  queryTokens: string[],
  query?: SemanticQuery,
): SearchRecord[] {
  const tokens = query?.tokens ?? queryTokens;
  if (!tokens.length && !query?.termWeights.size) {
    return index.records.map((item) => item.record);
  }

  const weights = query?.termWeights.size
    ? query.termWeights
    : new Map(tokens.map((token) => [token, 1]));
  const projected = queryVector(weights, index.idf);

  const scored = index.records.map((item) =>
    scoreRecord(
      item,
      tokens,
      index.idf,
      index.df,
      cosine(projected.vector, projected.norm, item),
      query,
    ),
  );

  const natural = Boolean(query?.natural);
  const required = natural ? Math.min(1, tokens.length) : tokens.length;
  let hits = scored.filter((hit) => {
    if (hit.matched >= required && required > 0) return true;
    if (natural && hit.cosine >= 0.09) return true;
    if (natural && hit.matched >= 1) return true;
    return false;
  });
  if (!hits.length) {
    const relaxed = Math.max(natural ? 0 : 1, required - 1);
    hits = scored.filter(
      (hit) => hit.matched >= relaxed || hit.cosine >= 0.06,
    );
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
