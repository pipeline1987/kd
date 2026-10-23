import "server-only";

import {
  DESK_TOOLS,
  readMission,
  runDeskTool,
  searchMissions,
  type DeskSource,
} from "@/lib/desk-tools";

export type DeskMessage = {
  role: "user" | "assistant";
  content: string;
};

export type DeskEvent =
  | { type: "status"; text: string }
  | { type: "sources"; items: DeskSource[] }
  | { type: "delta"; text: string }
  | { type: "error"; text: string }
  | { type: "done"; llm: boolean };

const SYSTEM = `You are the Konoha Daily mission desk clerk. You brief readers from the village's public mission ledger only.

Rules:
- Use search_missions, then read_mission on the files that answer the question.
- Answer only from tool results. If the ledger does not cover it, say the file is not in the public ledger.
- Cite files as markdown links: [title](/reports/slug). Include the mission ID (KD-year-number) and Konoha year.
- Keep the tone of an ANBU public ledger: dry, specific, no filler. Two to six short paragraphs.
- This is fan work. Do not claim official canon outside the retrieved reports.
- Never invent missions, dates, or deaths that are not in the retrieved files.`;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

function llmConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    ),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

export function deskUsesLlm(): boolean {
  return Boolean(llmConfig());
}

function uniqueSources(items: DeskSource[]): DeskSource[] {
  const seen = new Set<string>();
  const out: DeskSource[] = [];
  for (const item of items) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    out.push(item);
  }
  return out.slice(0, 8);
}

async function complete(messages: ChatMessage[]) {
  const config = llmConfig();
  if (!config) throw new Error("LLM is not configured");
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      max_tokens: 700,
      tools: DESK_TOOLS,
      messages,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Desk model failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: ChatMessage }>;
  };
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("Desk model returned no message");
  return message;
}

async function extractiveAnswer(question: string): Promise<{
  text: string;
  sources: DeskSource[];
}> {
  const hits = await searchMissions({ query: question, limit: 5 });
  if (hits.length === 0) {
    return {
      text: "No public file matches that question. Try a shinobi name, a village, a rank, or a Konoha year.",
      sources: [],
    };
  }
  const lead = readMission(hits[0]!.slug);
  const related = hits.slice(1, 4);
  const lines = [
    `The ledger’s closest file is [${lead?.title ?? hits[0]!.title}](${hits[0]!.href}) (${hits[0]!.missionId}, ${hits[0]!.rank}-rank, Year ${hits[0]!.year}).`,
    lead?.body[0] || hits[0]!.excerpt,
  ];
  if (related.length) {
    lines.push(
      `Related files: ${related
        .map((hit) => `[${hit.title}](${hit.href}) (${hit.missionId})`)
        .join("; ")}.`,
    );
  }
  return { text: lines.join("\n\n"), sources: hits };
}

async function emitText(
  text: string,
  emit: (event: DeskEvent) => void,
) {
  const chunks = text.split(/(\s+)/);
  for (const chunk of chunks) {
    if (!chunk) continue;
    emit({ type: "delta", text: chunk });
  }
}

export async function runDeskAgent(
  history: DeskMessage[],
  emit: (event: DeskEvent) => void,
): Promise<void> {
  const question = history.at(-1)?.content?.trim() ?? "";
  if (!question) {
    emit({ type: "error", text: "Ask a question of the ledger." });
    emit({ type: "done", llm: deskUsesLlm() });
    return;
  }

  const sources: DeskSource[] = [];
  const config = llmConfig();

  if (!config) {
    emit({ type: "status", text: "Searching the public ledger…" });
    const answer = await extractiveAnswer(question);
    if (answer.sources.length) {
      emit({ type: "sources", items: uniqueSources(answer.sources) });
    }
    await emitText(answer.text, emit);
    emit({ type: "done", llm: false });
    return;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    ...history.slice(-8).map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000),
    })),
  ];

  emit({ type: "status", text: "Asking the desk…" });

  for (let round = 0; round < 4; round++) {
    const message = await complete(messages);
    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      const text = message.content?.trim() || "The desk has nothing further on that file.";
      if (sources.length) emit({ type: "sources", items: uniqueSources(sources) });
      await emitText(text, emit);
      emit({ type: "done", llm: true });
      return;
    }

    messages.push({
      role: "assistant",
      content: message.content ?? "",
      tool_calls: calls,
    });

    for (const call of calls) {
      const name = call.function.name;
      emit({
        type: "status",
        text:
          name === "read_mission"
            ? "Opening a mission file…"
            : "Searching the public ledger…",
      });
      const { result, sources: found } = await runDeskTool(
        name,
        call.function.arguments,
      );
      sources.push(...found);
      if (found.length) emit({ type: "sources", items: uniqueSources(sources) });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.slice(0, 8000),
      });
    }
  }

  if (sources.length) emit({ type: "sources", items: uniqueSources(sources) });
  const fallback = await extractiveAnswer(question);
  await emitText(fallback.text, emit);
  emit({ type: "done", llm: true });
}
