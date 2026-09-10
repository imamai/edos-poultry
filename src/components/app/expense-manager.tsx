"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Expense, ExpenseCategory } from "@/lib/database.types";
import { formatMoney } from "@/lib/money";

export function ExpenseManager({
  tenantId,
  flockId,
  currency,
  categories,
  expenses,
}: {
  tenantId: string;
  flockId: string | null;
  currency: string;
  categories: ExpenseCategory[];
  expenses: (Expense & { poultryedos_expense_categories: { name: string } | null })[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = expenses.reduce((sum, e) => sum + e.amount_cents, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_expenses").insert({
      tenant_id: tenantId,
      flock_id: flockId,
      category_id: categoryId || null,
      amount_cents: Math.round(Number(amount) * 100),
      description: description || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAmount("");
    setDescription("");
    setAdding(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Expenses</h1>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
          >
            + Log
          </button>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-paper-raised p-5">
        <p className="text-xs text-ink-faint">Last 30 records</p>
        <p className="mt-1 font-display text-3xl font-medium text-ink">{formatMoney(total, currency)}</p>
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-line bg-paper-raised p-4">
          <div>
            <label className="text-sm font-medium text-ink-soft">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-ink-soft">Amount ({currency})</label>
            <input
              type="number"
              required
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-soft">Note (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-full border border-line-strong px-5 py-2.5 text-sm font-medium text-ink-soft"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {expenses.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No expenses logged yet.
          </p>
        )}
        {expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-ink">{e.poultryedos_expense_categories?.name ?? "Uncategorized"}</p>
              <p className="text-xs text-ink-faint">
                {new Date(e.expense_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                {e.description && ` · ${e.description}`}
              </p>
            </div>
            <span className="font-medium text-ink">{formatMoney(e.amount_cents, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
