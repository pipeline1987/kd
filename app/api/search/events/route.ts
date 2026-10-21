import { NextRequest } from "next/server";
import {
  appendSearchEvents,
  loadSearchAnalytics,
} from "@/lib/search-analytics-store";
import { parseAnalyticsEvent } from "@/lib/search-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const summary = await loadSearchAnalytics();
  return Response.json(summary);
}

export async function POST(request: NextRequest) {
  const text = await request.text();
  if (text.length > 50_000) {
    return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const incoming = (Array.isArray(raw) ? raw : [raw])
    .slice(0, 20)
    .map(parseAnalyticsEvent)
    .filter((event) => event !== null);

  if (incoming.length === 0) {
    return Response.json({ ok: false, error: "no events" }, { status: 400 });
  }

  const stored = await appendSearchEvents(incoming);
  return Response.json({ ok: true, stored });
}
