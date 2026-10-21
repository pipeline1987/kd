import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  parseAnalyticsEvent,
  summarizeEvents,
  type SearchAnalyticsEvent,
  type SearchAnalyticsSummary,
} from "@/lib/search-analytics";

const STORE_PATH = resolve(process.cwd(), "data/search-analytics.json");
const MAX_EVENTS = 4000;

let queue: Promise<unknown> = Promise.resolve();
let memory: SearchAnalyticsEvent[] = [];

async function readEvents(): Promise<SearchAnalyticsEvent[]> {
  try {
    const raw = JSON.parse(await readFile(STORE_PATH, "utf8")) as unknown;
    if (!Array.isArray(raw)) return memory;
    memory = raw
      .map(parseAnalyticsEvent)
      .filter((event): event is SearchAnalyticsEvent => event !== null);
    return memory;
  } catch {
    return memory;
  }
}

async function writeEvents(events: SearchAnalyticsEvent[]) {
  memory = events;
  try {
    await mkdir(dirname(STORE_PATH), { recursive: true });
    await writeFile(STORE_PATH, `${JSON.stringify(events)}\n`, "utf8");
  } catch {
    // Keep the in-memory ledger if the file cannot be written.
  }
}

function withStore<T>(fn: (events: SearchAnalyticsEvent[]) => Promise<T>): Promise<T> {
  const run = queue.then(() => readEvents()).then(fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function appendSearchEvents(
  incoming: SearchAnalyticsEvent[],
): Promise<number> {
  if (incoming.length === 0) return 0;
  return withStore(async (events) => {
    const next = [...events, ...incoming].slice(-MAX_EVENTS);
    await writeEvents(next);
    return incoming.length;
  });
}

export async function loadSearchAnalytics(): Promise<SearchAnalyticsSummary> {
  const events = await readEvents();
  return summarizeEvents(events);
}
