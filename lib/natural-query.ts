import { authors } from "@/data/authors";
import {
  ARCHIVE_END_YEAR,
  ARCHIVE_START_YEAR,
  ERAS,
  monthName,
} from "@/lib/article";
import { normalize, tokenize, tokenizeQuery } from "@/lib/search-relevance";
import type { MissionStatus, Rank } from "@/lib/types";

export type QueryIntent = {
  raw: string;
  isNatural: boolean;
  coreTokens: string[];
  termWeights: Map<string, number>;
  highlightTokens: string[];
  expansions: string[];
  rank?: Rank;
  years: number[];
  months: number[];
  eras: string[];
  status?: MissionStatus;
  classified?: boolean;
  author?: string;
  location?: string;
  topics: string[];
};

const FUNCTION_WORDS = new Set([
  "who",
  "what",
  "when",
  "where",
  "why",
  "how",
  "which",
  "whose",
  "whom",
  "did",
  "does",
  "done",
  "doing",
  "can",
  "could",
  "would",
  "should",
  "please",
  "tell",
  "show",
  "find",
  "look",
  "looking",
  "give",
  "need",
  "want",
  "bring",
  "brought",
  "back",
  "became",
  "become",
  "about",
  "happen",
  "happened",
  "happens",
  "during",
  "while",
  "related",
  "regarding",
  "concerning",
  "article",
  "articles",
  "report",
  "reports",
  "dispatch",
  "dispatches",
  "story",
  "stories",
  "news",
  "coverage",
  "something",
  "someone",
  "anyone",
  "anything",
  "describe",
  "explain",
  "there",
  "their",
  "they",
  "them",
  "been",
  "being",
  "were",
  "have",
  "has",
  "had",
  "was",
  "are",
  "the",
  "and",
  "for",
  "from",
  "with",
  "that",
  "this",
  "into",
  "onto",
  "over",
  "after",
  "before",
  "than",
  "then",
  "also",
  "just",
  "like",
  "some",
  "any",
  "all",
  "our",
  "out",
  "still",
  "very",
  "more",
  "most",
  "mission",
  "missions",
  "file",
  "files",
  "ledger",
  "paper",
  "daily",
  "konoha",
  "village",
  "leaf",
]);

const CONCEPT_GROUPS: string[][] = [
  [
    "pain",
    "nagato",
    "konan",
    "ame",
    "amegakure",
    "deva",
    "razed",
    "crater",
    "assault",
    "destroyed",
    "leveled",
    "flattened",
    "almighty",
    "shinra",
    "tensei",
  ],
  [
    "invasion",
    "crush",
    "oto",
    "sound",
    "orochimaru",
    "hiruzen",
    "professor",
    "third",
    "fallen",
    "funeral",
  ],
  [
    "hokage",
    "hat",
    "kage",
    "hiruzen",
    "tsunade",
    "kakashi",
    "naruto",
    "fifth",
    "sixth",
    "seventh",
    "installed",
    "succeeded",
  ],
  [
    "gaara",
    "kazekage",
    "abducted",
    "abduction",
    "kidnapped",
    "taken",
    "deidara",
    "sasori",
    "chiyo",
    "shukaku",
    "suna",
    "sand",
  ],
  [
    "sasuke",
    "uchiha",
    "retrieval",
    "defected",
    "left",
    "valley",
    "sound",
    "orochimaru",
    "failed",
  ],
  [
    "akatsuki",
    "cloak",
    "hidan",
    "kakuzu",
    "asuma",
    "pain",
    "itachi",
    "kisame",
    "tobi",
    "madara",
  ],
  [
    "war",
    "allied",
    "alliance",
    "tsukuyomi",
    "kaguya",
    "madara",
    "obito",
    "ten",
    "tails",
    "fourth",
  ],
  [
    "waves",
    "tazuna",
    "zabuza",
    "haku",
    "bridge",
    "gato",
    "mist",
  ],
  [
    "chunin",
    "chuunin",
    "exams",
    "exam",
    "forest",
    "death",
    "proctor",
    "arena",
  ],
  [
    "tora",
    "tama",
    "cat",
    "cats",
    "pet",
    "shijimi",
    "lost",
  ],
  [
    "wedding",
    "married",
    "marriage",
    "hinata",
    "ceremony",
    "feast",
  ],
  [
    "boruto",
    "sarada",
    "mitsuki",
    "otsutsuki",
    "momoshiki",
    "kinshiki",
  ],
  [
    "toneri",
    "moon",
    "lunar",
    "hinata",
  ],
  [
    "jiraiya",
    "sannin",
    "toad",
    "training",
  ],
  [
    "team",
    "genin",
    "academy",
    "graduates",
    "posted",
  ],
];

const PHRASE_EXPANSIONS: Array<{ pattern: RegExp; terms: string[] }> = [
  {
    pattern: /\bwho\s+(razed|destroyed|leveled|flattened|attacked)\b/i,
    terms: ["pain", "nagato", "assault", "crater", "razed"],
  },
  {
    pattern: /\bwhat\s+happened\s+(when|to|during)?\s*(pain|nagato|konoha|the village)?/i,
    terms: ["pain", "assault", "razed", "crater"],
  },
  {
    pattern: /\b(bring|brought|get|getting)\s+(sasuke|uchiha)\s+back\b/i,
    terms: ["retrieval", "sasuke", "uchiha", "failed"],
  },
  {
    pattern: /\b(sasuke)\s+(left|leaves|defected|fled)\b/i,
    terms: ["retrieval", "sasuke", "uchiha"],
  },
  {
    pattern: /\b(gaara|kazekage).{0,16}(taken|abducted|kidnapped|captured)\b/i,
    terms: ["kazekage", "abducted", "akatsuki", "gaara"],
  },
  {
    pattern: /\bwho\s+(became|is|was)\s+the\s+(third|fifth|sixth|seventh)\b/i,
    terms: ["hokage", "hat"],
  },
  {
    pattern: /\b(fifth|sixth|seventh)\s+hokage\b/i,
    terms: ["hokage", "hat"],
  },
  {
    pattern: /\b(wedding|married|marriage|wife|husband)\b/i,
    terms: ["married", "hinata", "wedding"],
  },
  {
    pattern: /\b(land of )?waves\b/i,
    terms: ["waves", "zabuza", "tazuna", "bridge"],
  },
  {
    pattern: /\binfinite tsukuyomi\b/i,
    terms: ["tsukuyomi", "kaguya", "madara", "war"],
  },
  {
    pattern: /\b(fourth )?(shinobi )?world war\b/i,
    terms: ["war", "allied", "tsukuyomi"],
  },
  {
    pattern: /\bfive kage summit\b/i,
    terms: ["summit", "kage", "war", "danzo"],
  },
  {
    pattern: /\b(lost )?cat\b/i,
    terms: ["tora", "shijimi", "pet"],
  },
];

const conceptOf = new Map<string, string[]>();
for (const group of CONCEPT_GROUPS) {
  for (const word of group) {
    const existing = conceptOf.get(word) ?? [];
    conceptOf.set(word, [...new Set([...existing, ...group])]);
  }
}

const NL_SIGNAL =
  /\b(who|what|when|where|why|how|which|whose|tell me|show me|find me|looking for|happened|about the|reports? about|missions? about|the one where)\b/i;

export function isNaturalLanguage(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (NL_SIGNAL.test(trimmed)) return true;
  if (/[?]/.test(trimmed)) return true;
  const tokens = tokenize(trimmed);
  if (tokens.length >= 6) return true;
  const functionHits = tokens.filter((token) => FUNCTION_WORDS.has(token));
  return tokens.length >= 4 && functionHits.length >= 2;
}

function expandTerm(term: string, weight: number, into: Map<string, number>) {
  into.set(term, Math.max(into.get(term) ?? 0, weight));
  const group = conceptOf.get(term);
  if (!group) return;
  for (const other of group) {
    if (other === term) continue;
    into.set(other, Math.max(into.get(other) ?? 0, weight * 0.62));
  }
}

export function parseNaturalQuery(query: string): QueryIntent {
  const raw = query.trim();
  const natural = isNaturalLanguage(raw);
  const lowered = raw.toLowerCase();
  const termWeights = new Map<string, number>();

  let rank: Rank | undefined;
  const rankMatch = lowered.match(
    /\b(?:rank\s*[:\-]?\s*([sabcd])|([sabcd])[\-–]?\s*ranks?)\b/,
  );
  if (rankMatch) {
    const letter = (rankMatch[1] ?? rankMatch[2] ?? "").toUpperCase();
    if ("SABCD".includes(letter)) rank = letter as Rank;
  }

  const years: number[] = [];
  const yearPattern = /\b(?:year\s*)?(6[4-9]|7[0-9]|8[0-3])\b/gi;
  for (const match of raw.matchAll(yearPattern)) {
    const year = Number(match[1]);
    if (
      year >= ARCHIVE_START_YEAR &&
      year <= ARCHIVE_END_YEAR &&
      !years.includes(year)
    ) {
      years.push(year);
    }
  }

  const months: number[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const name = monthName(month).toLowerCase();
    if (name && lowered.includes(name)) months.push(month);
  }

  const normalizedQuery = normalize(lowered);
  const eras = ERAS.filter((era) =>
    normalizedQuery.includes(normalize(era)),
  ) as string[];

  let status: MissionStatus | undefined;
  if (/\bfail(?:ed|ure)?\b/.test(lowered)) status = "Failed";
  else if (/\bongoing\b/.test(lowered)) status = "Ongoing";
  else if (/\bcompleted\b/.test(lowered)) status = "Completed";
  else if (/\bclassified\b/.test(lowered)) status = "Classified";

  const classified = /\bclassified\b/.test(lowered) ? true : undefined;

  let author: string | undefined;
  for (const person of authors) {
    const name = normalize(person.name);
    if (name && normalizedQuery.includes(name)) {
      author = person.name;
      break;
    }
    const first = name.split(" ")[0];
    if (
      first &&
      first.length > 3 &&
      new RegExp(`\\b${first}\\b`).test(normalizedQuery)
    ) {
      author = person.name;
      break;
    }
  }

  let location: string | undefined;
  for (const place of [
    "hokage tower",
    "ninja academy",
    "land of waves",
    "sunagakure",
    "nara forest",
    "land of iron",
    "village gate",
  ]) {
    if (lowered.includes(place)) {
      location = place;
      break;
    }
  }

  const topics: string[] = [];
  for (const topic of [
    "akatsuki",
    "hokage",
    "uchiha",
    "anbu",
    "bijuu",
    "chunin exams",
    "village defense",
    "missing-nin",
  ]) {
    if (lowered.includes(topic)) topics.push(topic);
  }

  for (const { pattern, terms } of PHRASE_EXPANSIONS) {
    if (pattern.test(raw)) {
      for (const term of terms) expandTerm(term, 1.15, termWeights);
    }
  }

  const queryTokens = tokenizeQuery(raw);
  const structural = new Set<string>();
  if (rank) structural.add("rank");
  if (years.length) structural.add("year");
  if (months.length) structural.add("month");
  if (status) structural.add("status");

  const coreTokens = queryTokens.filter((token) => {
    if (structural.has(token)) return false;
    if (natural && FUNCTION_WORDS.has(token)) return false;
    return true;
  });
  const seeds = coreTokens.length
    ? coreTokens
    : years.length
      ? years.map(String)
      : queryTokens;

  for (const token of seeds) expandTerm(token, 1, termWeights);

  if (rank) expandTerm(rank.toLowerCase() === "s" ? "rank" : rank.toLowerCase(), 0.8, termWeights);
  for (const year of years) expandTerm(String(year), 1, termWeights);
  if (status) expandTerm(normalize(status), 0.9, termWeights);
  if (author) for (const token of tokenize(author)) expandTerm(token, 1, termWeights);
  if (location) for (const token of tokenize(location)) expandTerm(token, 1, termWeights);

  const expansions = [...termWeights.keys()].filter(
    (term) => !seeds.includes(term),
  );

  return {
    raw,
    isNatural: natural,
    coreTokens: seeds,
    termWeights,
    highlightTokens: seeds,
    expansions,
    rank,
    years,
    months,
    eras,
    status,
    classified,
    author,
    location,
    topics,
  };
}

export function rewriteForKeywordEngine(query: string): string {
  const intent = parseNaturalQuery(query);
  if (!intent.expansions.length) return query;
  const extra = intent.expansions.slice(0, 12);
  return `${query} ${extra.join(" ")}`.trim();
}
