import { NextRequest } from "next/server";
import { deskUsesLlm, runDeskAgent, type DeskMessage } from "@/lib/desk-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMessages(raw: unknown): DeskMessage[] {
  if (!raw || typeof raw !== "object") return [];
  const messages = (raw as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return [];
  return messages
    .slice(-8)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as { role?: unknown; content?: unknown };
      if (value.role !== "user" && value.role !== "assistant") return null;
      const content = String(value.content ?? "").trim().slice(0, 2000);
      if (!content) return null;
      return { role: value.role, content };
    })
    .filter((item): item is DeskMessage => item !== null);
}

export async function GET() {
  return Response.json({ llm: deskUsesLlm() });
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const messages = parseMessages(raw);
  if (messages.length === 0 || messages.at(-1)?.role !== "user") {
    return Response.json({ error: "ask a question" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await runDeskAgent(messages, send);
      } catch (error) {
        send({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "The desk could not complete that briefing.",
        });
        send({ type: "done", llm: deskUsesLlm() });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
