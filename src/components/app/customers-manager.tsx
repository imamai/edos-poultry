"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Customer, CustomerType } from "@/lib/database.types";

const TYPES: CustomerType[] = [
  "individual",
  "hotel",
  "restaurant",
  "school",
  "hospital",
  "supermarket",
  "wholesaler",
  "retailer",
  "aggregator",
  "processor",
];

export function CustomersManager({ tenantId, customers }: { tenantId: string; customers: Customer[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Customers</h1>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
          >
            + Add customer
          </button>
        )}
      </div>

      {adding && (
        <CustomerForm tenantId={tenantId} onDone={() => setAdding(false)} />
      )}

      <div className="mt-4 space-y-2">
        {customers.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No customers yet.
          </p>
        )}
        {customers.map((c) =>
          editingId === c.id ? (
            <CustomerForm key={c.id} tenantId={tenantId} initial={c} onDone={() => setEditingId(null)} />
          ) : (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-line bg-paper-raised px-4 py-3">
              <div>
                <p className="font-medium text-ink">{c.name}</p>
                <p className="text-xs text-ink-faint">
                  {c.phone ?? "No phone on file"} · <span className="capitalize">{c.customer_type}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(c.id)}
                className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
              >
                Edit
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function CustomerForm({
  tenantId,
  initial,
  onDone,
}: {
  tenantId: string;
  initial?: Customer;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [customerType, setCustomerType] = useState<CustomerType>(initial?.customer_type ?? "individual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const payload = { tenant_id: tenantId, name, phone: phone || null, customer_type: customerType };
    const { error } = initial
      ? await supabase.from("poultryedos_customers").update(payload).eq("id", initial.id)
      : await supabase.from("poultryedos_customers").insert(payload);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border border-line bg-paper-raised p-4">
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Customer name"
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone / contacts"
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <select
        value={customerType}
        onChange={(e) => setCustomerType(e.target.value as CustomerType)}
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
      >
        {TYPES.map((t) => (
          <option key={t} value={t} className="capitalize">
            {t}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onDone} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
