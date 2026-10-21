import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARCHIVE_END_YEAR,
  ARCHIVE_START_YEAR,
  makeArticle,
} from "../lib/article";
import type { Article, Rank, SearchRecord } from "../lib/types";
import { landmarks } from "../data/landmarks";

const DAYS = [3, 11, 18, 26];

const PETS = [
  "Tora",
  "Tama",
  "Pochi",
  "Chibi",
  "Momo",
  "Koro",
  "Hana",
  "Sora",
  "Yuki",
  "Aka",
  "Bean",
  "Gourd",
  "Nibi",
  "Kettle",
  "Plum",
];

const DISTRICTS = [
  "the Commercial District",
  "the Naka River banks",
  "the Academy gardens",
  "the hospital laundry yards",
  "Training Ground 3",
  "the Village Gate market",
  "the Hyūga compound wall",
  "the Nara forest edge",
  "Akimichi barbecue street",
  "the old Uchiha district memorial",
  "Ichiraku's back alley",
  "the hot-spring quarter",
  "the Hokage Monument scaffolding",
  "the west greenhouses",
  "the civilian housing rows",
];

const LANDS = [
  "the Land of Tea",
  "the Land of Rivers",
  "the Land of Waves",
  "the Land of Hot Water",
  "the Land of Grass",
  "the Land of Waterfalls",
  "Tanzaku Quarters",
  "the Fire Daimyō's road",
  "the Sand border",
  "the Iron mountain pass",
  "the Rain Country fence",
  "the Rice Field highway",
];

const ANIMALS = [
  "a chakra-starved bear",
  "a pack of river wolves",
  "a runaway summoning hawk",
  "boars in the sweet-potato fields",
  "a molting giant snake",
  "bandit-trained hawks",
  "a mad ox from the daimyō's herd",
];

const CLIENTS = [
  "a Fire Country merchant guild",
  "the Hospital procurement office",
  "Madame Shijimi's household",
  "the Academy headmaster's office",
  "a tea caravan out of Tanzaku",
  "the Nara clan pasture board",
  "a civilian carpenter's union",
  "the Fire Temple",
  "the barrier team",
  "the Mission Desk itself",
];

const TEAMS = [
  "Team 8",
  "Team 10",
  "Team Guy",
  "a mixed genin cell under Iwashi",
  "Hayate Gekkō's students",
  "a chūnin pair from the gate",
  "ANBU Team Ro on loan",
  "the Ino–Shika–Chō cell",
  "a medical-nin trio",
  "Konohamaru's old three",
  "a tokubetsu jōnin escort",
  "the night barrier watch",
];

const QUOTES = [
  "“The mission comes first. The ramen comes after.” — overheard at Ichiraku.",
  "“Tell the Hokage the road is clear.”",
  "“D-rank is still a rank,” Iruka reminds the desk each week.",
  "“If it has a tail and a bounty, it is not a D-rank.” — Anko, in the margin.",
  "“Clone or not, someone has to stamp the form.”",
  "“The forest does not care what year it is.”",
  "“Paid in full. No one in the hospital. Print it.”",
  "“We do not file rumors. We file names.”",
  "“The gate log matches the client’s story, for once.”",
  "“Another cat. Another generation.”",
  "“Sand sent a thank-you. File it under alliance, not poetry.”",
  "“The seal covers the jutsu. It does not cover the mud.”",
];

const D_JOBS = [
  "weeding",
  "babysitting",
  "fence-mending",
  "bridge-sweeping",
  "lantern-hanging",
  "market-crowd control",
  "lost-pet recovery",
  "greenhouse watering",
  "monument cleaning",
  "festival setup",
  "archive shelving",
  "hospital porter duty",
];

function mulberry32(seed: number) {
  let a = seed;
  return function rand() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, list: T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

function pickN<T>(rand: () => number, list: T[], count: number): T[] {
  const copy = [...list];
  const out: T[] = [];
  while (out.length < count && copy.length) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
  }
  return out;
}

function between(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function feeFor(rank: Rank, rand: () => number): number {
  const ranges: Record<Rank, [number, number]> = {
    D: [5000, 50000],
    C: [30000, 100000],
    B: [80000, 200000],
    A: [150000, 1000000],
    S: [1000000, 3000000],
  };
  const [min, max] = ranges[rank];
  return Math.round(between(rand, min, max) / 1000) * 1000;
}

function authorsFor(year: number, month: number): { name: string; slug: string }[] {
  const base = [
    { name: "Kayo Shiranui", slug: "kayo-shiranui" },
    { name: "Shizune", slug: "shizune" },
    { name: "Iruka Umino", slug: "iruka-umino" },
    { name: "Anko Mitarashi", slug: "anko-mitarashi" },
    { name: "Genma Shiranui", slug: "genma-shiranui" },
    { name: "Raidō Namiashi", slug: "raido-namiashi" },
    { name: "Tsubaki of the Press Corps", slug: "tsubaki-press" },
  ];
  if (year < 68 || (year === 68 && month < 10)) {
    base.push(
      { name: "Inoichi Yamanaka", slug: "inoichi-yamanaka" },
      { name: "Shikaku Nara", slug: "shikaku-nara" },
    );
  }
  if (year >= 67) base.push({ name: "Ino Yamanaka", slug: "ino-yamanaka" });
  if (year >= 70) {
    base.push(
      { name: "Moegi Kazamatsuri", slug: "moegi-kazamatsuri" },
      { name: "Udon Ise", slug: "udon-ise" },
    );
  }
  if (year >= 75) {
    base.push({ name: "Konohamaru Sarutobi", slug: "konohamaru-sarutobi" });
  }
  return base;
}

function rankFor(year: number, month: number, rand: () => number): Rank {
  let weights: Record<Rank, number> = { D: 40, C: 28, B: 18, A: 11, S: 3 };
  if (year === 64 && month >= 7) {
    weights = { D: 22, C: 22, B: 24, A: 22, S: 10 };
  } else if (year === 67 || year === 68) {
    weights = { D: 16, C: 20, B: 24, A: 26, S: 14 };
  } else if (year >= 69 && year <= 74) {
    weights = { D: 38, C: 30, B: 18, A: 11, S: 3 };
  } else if (year >= 75) {
    weights = { D: 44, C: 30, B: 16, A: 8, S: 2 };
  }
  const total = Object.values(weights).reduce((sum, n) => sum + n, 0);
  let roll = rand() * total;
  for (const rank of ["D", "C", "B", "A", "S"] as Rank[]) {
    roll -= weights[rank];
    if (roll <= 0) return rank;
  }
  return "D";
}

function topicsFor(rank: Rank, year: number, rand: () => number): string[] {
  const civic = ["Civic", "Genin Corps", "Academy"];
  const field = ["Border Patrol", "Trade", "Five Nations"];
  const dark = ["Missing-nin", "ANBU", "Classified"];
  const war = ["War", "Allied Shinobi", "Village Defense"];
  const peace = ["Reconstruction", "Diplomacy", "Hospital", "Medical"];
  const clans = ["Clans", "Hokage", "Uchiha", "Hyuga"];
  let pool = [...civic, ...field, "Hospital"];
  if (rank === "D") pool = [...civic, "Civic", "Trade", "Hospital"];
  if (rank === "C") pool = [...civic, ...field, "Medical"];
  if (rank === "B") pool = [...field, ...dark, "Diplomacy", "Clans"];
  if (rank === "A" || rank === "S") {
    pool = [...dark, ...clans, "Five Nations", "Village Defense"];
  }
  if (year === 64) pool.push("Chunin Exams", "Sand Alliance", "Land of Waves");
  if (year === 67 || year === 68) pool.push("Akatsuki", "Bijuu", ...war);
  if (year >= 67 && year <= 70) pool.push("Reconstruction");
  if (year >= 69) pool.push(...peace);
  if (year >= 75) pool.push("Academy", "Civic", "Diplomacy");
  if (year === 83) pool.push("Chunin Exams", "Classified");
  return pickN(rand, Array.from(new Set(pool)), between(rand, 2, 4));
}

function authorFor(
  rank: Rank,
  year: number,
  month: number,
  rand: () => number,
): { name: string; slug: string } {
  const pool = authorsFor(year, month);
  if (rank === "D") {
    const civic = pool.filter((author) =>
      ["iruka-umino", "udon-ise", "moegi-kazamatsuri", "kayo-shiranui"].includes(
        author.slug,
      ),
    );
    if (civic.length) return pick(rand, civic);
  }
  if (rank === "S" || rank === "A") {
    const hard = pool.filter((author) =>
      [
        "raido-namiashi",
        "anko-mitarashi",
        "tsubaki-press",
        "shikaku-nara",
        "inoichi-yamanaka",
        "kayo-shiranui",
      ].includes(author.slug),
    );
    if (hard.length) return pick(rand, hard);
  }
  return pick(rand, pool);
}

function buildFiller(
  year: number,
  month: number,
  day: number,
  sequence: number,
  rand: () => number,
): Article {
  const rank = rankFor(year, month, rand);
  const author = authorFor(rank, year, month, rand);
  const topics = topicsFor(rank, year, rand);
  const team = pick(rand, TEAMS);
  const client = pick(rand, CLIENTS);
  const quote = pick(rand, QUOTES);
  const feeRyo = feeFor(rank, rand);
  const classified = rank === "S" && rand() > 0.45;

  if (rank === "D") {
    const district = pick(rand, DISTRICTS);
    const job = pick(rand, D_JOBS);
    const pet = pick(rand, PETS);
    const isPet = job === "lost-pet recovery" || rand() > 0.72;
    const title = isPet
      ? `D-RANK: ${pet} recovered in ${district}`
      : `D-RANK: ${cap(job)} at ${district}`;
    const location = district.replace(/^the /, "");
    return makeArticle({
      sequence,
      year,
      month,
      day,
      rank,
      author: author.name,
      authorSlug: author.slug,
      location,
      feeRyo,
      topics,
      title,
      excerpt: isPet
        ? `${team} returned ${pet} to ${client} before dusk. Scratches reported. No enemy ninja.`
        : `${team} finished ${job} for ${client}. The Mission Desk stamped it before the evening bell.`,
      body: [
        `Mission ${year}.${month}.${day} was posted at first light. Rank D. Client: ${client}. Assigned: ${team}. The work was ${isPet ? `the recovery of ${pet}` : job} in ${district}. Fee: ${feeRyo.toLocaleString("en-US")} ryō, paid to the village, not the genin.`,
        isPet
          ? `${pet} was located in a tree, a drain, or a clan compound — the after-action does not romanticize it. One genin required ointment. The client signed. The Academy desk notes that lost-animal work remains the most requested D-rank in the ledger.`
          : `No chakra signatures of note. A civilian thanked the cell by name; the names are in the tower file. ${job} does not look like shinobi work from the monument. It is how the village stays a village.`,
        quote,
      ],
    });
  }

  if (rank === "C") {
    const land = pick(rand, LANDS);
    const animal = pick(rand, ANIMALS);
    const escort = rand() > 0.5;
    const title = escort
      ? `C-RANK: Caravan escorted through ${land}`
      : `C-RANK: ${cap(animal)} suppressed along ${land}`;
    return makeArticle({
      sequence,
      year,
      month,
      day,
      rank,
      author: author.name,
      authorSlug: author.slug,
      location: land,
      feeRyo,
      topics,
      title,
      excerpt: escort
        ? `${cap(team)} brought ${client} through ${land}. Bandits, not ninja. The cargo arrived.`
        : `${cap(team)} was hired to stop ${animal}. Combat stayed below the ninja line. Barely.`,
      body: [
        `C-rank work is supposed to mean no enemy shinobi. ${team} left the gate at dawn for ${land}, hired by ${client}. The brief promised ${escort ? "highwaymen at worst" : animal}.`,
        escort
          ? `Three contacts on the road. Knives, not jutsu. Two detained, one fled into the grass. The caravan's count matched the departure scroll. Konoha still sells safety better than most banners on that road.`
          : `The creature was real. The chakra in it was leftover, not directed. ${team} bound it without a hospital run. Farmers on the ${land} road will sleep. That is a C-rank, and it is enough.`,
        quote,
      ],
    });
  }

  if (rank === "B") {
    const land = pick(rand, LANDS);
    const title =
      rand() > 0.5
        ? `B-RANK: Border watch along ${land}`
        : `B-RANK: Foreign chakra intercepted near ${land}`;
    return makeArticle({
      sequence,
      year,
      month,
      day,
      rank,
      author: author.name,
      authorSlug: author.slug,
      location: land,
      feeRyo,
      topics,
      classified,
      title,
      excerpt: `${team} met ninja-level resistance along ${land}. Details trimmed to what the seal allows.`,
      body: [
        `B-rank means the desk expected enemy ninja. ${team} was posted along ${land} at the request of ${client}. The opposing headcount is in the ANBU annex, not in this column.`,
        `Contact lasted ${between(rand, 8, 40)} minutes. No Konoha fatalities. ${between(rand, 0, 2)} wounded treated by Shizune's night staff. The village does not name the other headband in a public ledger when the treaty is still warm.`,
        classified
          ? "The remainder of the jutsu list is sealed. The fact of the mission is not."
          : quote,
      ],
    });
  }

  if (rank === "A") {
    const land = pick(rand, LANDS);
    const title =
      rand() > 0.4
        ? `A-RANK: VIP protection through ${land}`
        : `A-RANK: Ninja force suppressed on ${land}`;
    return makeArticle({
      sequence,
      year,
      month,
      day,
      rank,
      author: author.name,
      authorSlug: author.slug,
      location: land,
      feeRyo,
      topics,
      title,
      excerpt: `Jōnin-level work for ${client}. ${team} held the line. The tower initialed before midnight.`,
      body: [
        `A-rank missions concern the village or the state. This one concerned ${land}, ${client}, and a cell that could have become a headline if it had gone the other way. Assigned: ${cap(team)}.`,
        `The Fifth, Sixth, or Seventh — whoever sat the hat that week — received the verbal. This paper receives the sentence we can print: objective complete, Konoha force intact, foreign casualties not enumerated here.`,
        quote,
      ],
    });
  }

  const land = pick(rand, LANDS);
  const title = classified
    ? `S-RANK: Classified courier — ${land} route sealed`
    : `S-RANK: State file moved through ${land}`;
  return makeArticle({
    sequence,
    year,
    month,
    day,
    rank,
    author: author.name,
    authorSlug: author.slug,
    location: land,
    feeRyo,
    topics,
    classified: true,
    status: "Classified",
    title,
    excerpt:
      "Experienced jōnin, state secrets, a number with too many zeroes. The public ledger gets a rank and a date.",
    body: [
      `S-rank: assigned to experienced jōnin; state-level confidential work. Route: ${land}. Client: ${client}. Fee at or above one million ryō. The names of the carriers are not printed.`,
      classified
        ? "The scroll contents are sealed under the Hokage's mark. Failure of an S-rank is how villages lose more than money. This one did not fail."
        : `Enough of the file is public to say the document arrived. Enough is sealed to keep the next war from starting in this column.`,
      "All ranks, D to S, reported daily — including the ones that are mostly black ink.",
    ],
  });
}

function toSearchRecord(article: Article): SearchRecord {
  return { ...article, body: article.body.join(" ") };
}

function main() {
  const taken = new Set(
    landmarks.map((article) => `${article.year}-${article.month}-${article.day}`),
  );
  const articles: Article[] = [...landmarks];
  let sequence = 1000;
  const rand = mulberry32(64);

  for (let year = ARCHIVE_START_YEAR; year <= ARCHIVE_END_YEAR; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      for (const day of DAYS) {
        const key = `${year}-${month}-${day}`;
        if (taken.has(key)) continue;
        sequence += 1;
        articles.push(buildFiller(year, month, day, sequence, rand));
      }
    }
  }

  articles.sort((a, b) => b.publishedAt - a.publishedAt);

  const records = articles.map(toSearchRecord);
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const dataDir = resolve(root, "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(resolve(dataDir, "articles.json"), JSON.stringify(articles, null, 2));
  writeFileSync(
    resolve(dataDir, "search-records.json"),
    JSON.stringify(records, null, 2),
  );

  const byRank: Record<string, number> = {};
  for (const article of articles) {
    byRank[article.rank] = (byRank[article.rank] ?? 0) + 1;
  }
  const years = new Set(articles.map((article) => article.year));

  console.log(
    `Wrote ${articles.length} mission reports across ${years.size} years.`,
  );
  console.log("Ranks", byRank);
}

main();
