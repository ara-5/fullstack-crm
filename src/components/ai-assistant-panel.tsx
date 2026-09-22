"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { resolveAgentProposalAction, sendAgentMessageAction } from "@/app/(app)/assistant/actions";
import { Button } from "@/components/ui";
import { cx } from "@/lib/utils";

type ProposalStatus = "pending" | "approved" | "rejected" | "error";
type Proposal = { id: string; tool: string; summary: string; status: ProposalStatus; resultMessage?: string };
type ChatMessage = { id: string; role: "user" | "assistant"; text: string; proposals?: Proposal[] };

/**
 * The agentic command layer's UI: a chat drawer where every write the
 * assistant wants to make shows up as a card requiring an explicit Approve
 * click (see src/lib/agent.ts) before anything in the CRM actually changes.
 */
export function AiAssistantPanel({ aiEnabled }: { aiEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  if (!aiEnabled) return null;

  function scrollToEnd() {
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text }]);
    scrollToEnd();
    startTransition(async () => {
      const result = await sendAgentMessageAction(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.data.reply,
          proposals: result.data.proposals.map((p) => ({ ...p, status: "pending" as const })),
        },
      ]);
      scrollToEnd();
    });
  }

  function resolve(messageId: string, proposalId: string, approve: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await resolveAgentProposalAction(proposalId, approve);
      setMessages((all) =>
        all.map((m) => {
          if (m.id !== messageId || !m.proposals) return m;
          return {
            ...m,
            proposals: m.proposals.map((p) =>
              p.id === proposalId
                ? {
                    ...p,
                    status: result.ok ? (approve ? ("approved" as const) : ("rejected" as const)) : ("error" as const),
                    resultMessage: result.ok ? result.message : result.error,
                  }
                : p,
            ),
          };
        }),
      );
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="AI assistant"
        aria-expanded={open}
        className="fixed right-5 bottom-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-500"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6" aria-hidden>
          <path d="M10 2a1 1 0 01.894.553l1.618 3.236 3.236 1.618a1 1 0 010 1.786l-3.236 1.618-1.618 3.236a1 1 0 01-1.788 0l-1.618-3.236-3.236-1.618a1 1 0 010-1.786l3.236-1.618 1.618-3.236A1 1 0 0110 2z" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI assistant"
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-slate-200 bg-surface shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">AI assistant</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="text-slate-400 hover:text-slate-700">
              ✕
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                Ask about deals, contacts, or tasks — e.g. &quot;what&apos;s overdue this week?&quot; or &quot;draft a
                follow-up to Ada about the renewal&quot;.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cx("text-sm", m.role === "user" && "text-right")}>
                <div
                  className={cx(
                    "inline-block max-w-[90%] rounded-lg px-3 py-2 text-left",
                    m.role === "user" ? "bg-indigo-600 text-white" : "bg-canvas text-slate-800",
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
                {m.proposals && m.proposals.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {m.proposals.map((p) => (
                      <div key={p.id} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-left text-xs">
                        <p className="text-amber-900">{p.summary}</p>
                        {p.status === "pending" ? (
                          <div className="mt-2 flex gap-2">
                            <Button variant="primary" className="px-2 py-1 text-xs" onClick={() => resolve(m.id, p.id, true)} disabled={pending}>
                              Approve
                            </Button>
                            <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => resolve(m.id, p.id, false)} disabled={pending}>
                              Dismiss
                            </Button>
                          </div>
                        ) : (
                          <p
                            className={cx(
                              "mt-1 font-medium",
                              p.status === "approved" ? "text-emerald-700" : p.status === "rejected" ? "text-slate-500" : "text-red-700",
                            )}
                          >
                            {p.status === "approved" ? "✓ " : p.status === "error" ? "✕ " : ""}
                            {p.status === "rejected" ? "Dismissed" : p.resultMessage}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {pending && <p className="text-xs text-slate-400">Thinking…</p>}
            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
          </div>

          <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask the assistant…"
              disabled={pending}
              aria-label="Message the AI assistant"
              className="flex-1 rounded-md border-0 bg-canvas px-2.5 py-1.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button type="submit" disabled={pending || !input.trim()}>
              Send
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
