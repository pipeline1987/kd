import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { algoliasearch } from "algoliasearch";
import { INDEX_NAME } from "../lib/article";
import type { SearchRecord } from "../lib/types";

function loadEnv(root: string) {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and add your Algolia keys.`);
  }
  return value;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  loadEnv(root);

  const appId = env("NEXT_PUBLIC_ALGOLIA_APP_ID");
  const adminKey = env("ALGOLIA_ADMIN_KEY");
  const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || INDEX_NAME;
  const records = JSON.parse(
    readFileSync(resolve(root, "data/search-records.json"), "utf8"),
  ) as SearchRecord[];

  const client = algoliasearch(appId, adminKey);

  const { taskID } = await client.setSettings({
    indexName,
    indexSettings: {
      searchableAttributes: [
        "unordered(title)",
        "unordered(excerpt)",
        "unordered(author)",
        "unordered(topics)",
        "unordered(location)",
        "missionId",
      ],
      attributesForFaceting: [
        "searchable(author)",
        "searchable(topics)",
        "rank",
        "year",
        "month",
        "era",
        "status",
      ],
      attributesToRetrieve: [
        "title",
        "excerpt",
        "author",
        "authorSlug",
        "rank",
        "topics",
        "year",
        "month",
        "day",
        "publishedAt",
        "era",
        "location",
        "slug",
        "missionId",
        "status",
        "classified",
        "feeRyo",
      ],
      customRanking: ["desc(publishedAt)"],
      attributesToHighlight: ["title", "excerpt", "author"],
      hitsPerPage: 12,
    },
  });
  await client.waitForTask({ indexName, taskID });

  await client.clearObjects({ indexName });
  await client.saveObjects({
    indexName,
    objects: records,
    waitForTasks: true,
  });

  console.log(`Indexed ${records.length} mission reports into ${indexName}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
