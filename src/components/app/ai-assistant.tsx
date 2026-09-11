"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import type { AssistantQuestion } from "@/lib/ai/assistant";

interface Exchange {
  question: string;
  answer: string;
}

export function AiAssistant({
  questions,
  llmConfigured,
  hasFarm,
}: {
  questions: AssistantQuestion[];
  llmConfigured: boolean;
  hasFarm: boolean;
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [freeform, setFreeform] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function ask(questionId: string, label: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const data = (await res.json()) as { answer?: string; message?: string };
      setExchanges((prev) => [...prev, { question: label, answer: data.answer ?? data.message ?? "No answer." }]);
    } catch {
      setError("Could not reach the assistant. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function askFreeform(e: React.FormEvent) {
    e.preventDefault();
    if (!freeform.trim()) return;
    setBusy(true);
    setError(null);
    const question = freeform.trim();
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeform: question }),
      });
      const data = (await res.json()) as { answer?: string; message?: string };
      if (!res.ok) {
        setError(data.message ?? "Could not answer that.");
      } else {
        setExchanges((prev) => [...prev, { question, answer: data.answer ?? "No answer." }]);
        setFreeform("");
      }
    } catch {
      setError("Could not reach the assistant. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Ask about your farm</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Answers are calculated from your own recorded data — never a diagnosis or prescription.
      </p>

      {!hasFarm && (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          Some questions need a farm/flock of your own to answer fully.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {questions.map((q) => (
          <button
            key={q.id}
            type="button"
            disabled={busy}
            onClick={() => ask(q.id, q.label)}
            className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary disabled:opacity-60"
          >
            {q.label}
          </button>
        ))}
      </div>

      {llmConfigured ? (
        <form onSubmit={askFreeform} className="mt-4 flex gap-2">
          <input
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
            placeholder="Or type your own question…"
            className="flex-1 rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button type="submit" disabled={busy || !freeform.trim()} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Ask
          </button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-ink-faint">
          Free-text questions aren&apos;t configured for this environment yet — use the questions above.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-6 space-y-3">
        {exchanges.map((ex, i) => (
          <div key={i} className="rounded-xl border border-line bg-paper-raised p-4">
            <p className="flex items-center gap-2 text-xs font-medium text-ink-faint">
              <Bot className="h-3.5 w-3.5" /> {ex.question}
            </p>
            <p className="mt-1.5 text-sm text-ink">{ex.answer}</p>
          </div>
        ))}
        {exchanges.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            Tap a question above to get an answer grounded in your own records.
          </p>
        )}
      </div>
    </div>
  );
}
