"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Source = {
  slug: string;
  title: string;
  missionId: string;
  rank: string;
  year: number;
  href: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  status?: string;
};

const PROMPTS = [
  "Who razed the village?",
  "What happened to Asuma?",
  "Who became the Seventh Hokage?",
  "S-rank files from Year 64",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderCopy(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2]!;
      const label = link[1]!;
      if (href.startsWith("/")) {
        return (
          <Link key={`${href}-${index}`} href={href}>
            {label}
          </Link>
        );
      }
      return (
        <a key={`${href}-${index}`} href={href} rel="noreferrer">
          {label}
        </a>
      );
    }
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={index}>{bold[1]}</strong>;
    return <span key={index}>{part}</span>;
  });
}

export function DeskChat() {
  const [llm, setLlm] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/desk")
      .then((response) => response.json())
      .then((payload: { llm?: boolean }) => setLlm(Boolean(payload.llm)))
      .catch(() => setLlm(false));
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, busy]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const user: ChatMessage = { id: uid(), role: "user", content: text };
    const pending: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: "",
      status: "The clerk is opening the ledger…",
    };
    const next = [...messages, user];
    setMessages([...next, pending]);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error("The desk did not answer.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let sources: Source[] = pending.sources ?? [];
      let status = pending.status;

      const flush = (partial: string) => {
        buffer += partial;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: {
            type?: string;
            text?: string;
            items?: Source[];
          };
          try {
            event = JSON.parse(line) as typeof event;
          } catch {
            continue;
          }
          if (event.type === "status" && event.text) status = event.text;
          if (event.type === "delta" && event.text) {
            content += event.text;
            status = undefined;
          }
          if (event.type === "sources" && event.items) sources = event.items;
          if (event.type === "error" && event.text) {
            content = content || event.text;
            status = undefined;
          }
          setMessages((current) =>
            current.map((message) =>
              message.id === pending.id
                ? { ...message, content, sources, status }
                : message,
            ),
          );
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          flush("\n");
          break;
        }
        flush(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === pending.id
            ? {
                ...message,
                status: undefined,
                content:
                  error instanceof Error
                    ? error.message
                    : "The desk could not complete that briefing.",
              }
            : message,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desk-chat">
      <p className="desk-mode">
        {llm
          ? "ANBU analyst · searches the ledger, then briefs you."
          : llm === false
            ? "Ledger search · answers from matching mission files."
            : "Opening the desk…"}
      </p>

      <div className="desk-prompts" aria-label="Suggested questions">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={busy}
            onClick={() => void ask(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="desk-log" ref={scroller}>
        {messages.length === 0 ? (
          <p className="desk-empty">
            Ask who razed the village, who took the hat, or what an S-rank in
            Year 67 filed. Answers come from the public mission reports.
          </p>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={
                message.role === "user" ? "desk-bubble user" : "desk-bubble clerk"
              }
            >
              <p className="desk-who">
                {message.role === "user" ? "Reader" : "Mission desk"}
              </p>
              {message.status ? <p className="desk-status">{message.status}</p> : null}
              {message.content ? (
                <div className="desk-copy">
                  {message.content.split("\n\n").map((paragraph, index) => (
                    <p key={`${message.id}-${index}`}>{renderCopy(paragraph)}</p>
                  ))}
                </div>
              ) : null}
              {message.sources && message.sources.length > 0 ? (
                <ul className="desk-sources">
                  {message.sources.map((source) => (
                    <li key={source.slug}>
                      <Link href={source.href}>
                        {source.missionId} · {source.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        )}
      </div>

      <form
        className="desk-form"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
      >
        <label htmlFor="desk-q" className="sr-only">
          Ask the mission desk
        </label>
        <input
          id="desk-q"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask the ledger: who razed the village, failed retrieval, S-rank in Year 67…"
          autoComplete="off"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Brief me
        </button>
      </form>
    </div>
  );
}
