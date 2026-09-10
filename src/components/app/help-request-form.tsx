"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TicketPriority } from "@/lib/database.types";

const EXAMPLES = [
  "Birds are dying",
  "Egg production has dropped",
  "Birds are not eating",
  "Need vaccination reminder",
  "Need market for my produce",
  "Need feed",
  "Need veterinary assistance",
];

export function HelpRequestForm({
  tenantId,
  farmerId,
  flockId,
}: {
  tenantId: string;
  farmerId: string;
  flockId: string | null;
}) {
  const router = useRouter();
  const [problem, setProblem] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_support_tickets").insert({
      tenant_id: tenantId,
      farmer_id: farmerId,
      flock_id: flockId,
      problem,
      priority,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-2xl border border-success bg-success-soft p-6 text-center">
        <p className="font-medium text-success">Request sent.</p>
        <p className="mt-1 text-sm text-ink-soft">We&apos;ll follow up with you.</p>
        <button
          type="button"
          onClick={() => router.push("/app/home")}
          className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-primary-dark"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label className="text-sm font-medium text-ink-soft">What&apos;s the problem?</label>
        <textarea
          required
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={4}
          placeholder="Describe what you're seeing…"
          className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setProblem(ex)}
              className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft hover:border-primary"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-ink-soft">How urgent is this?</label>
        <div className="mt-2 flex gap-2">
          {(["low", "medium", "high"] as TicketPriority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`flex-1 rounded-full border px-3 py-2 text-sm capitalize ${
                priority === p
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-line-strong text-ink-soft"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
