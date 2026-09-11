"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Flock, PaymentMethod, Sale, SaleProduct } from "@/lib/database.types";
import { formatMoney } from "@/lib/money";
import { PrintHeader, PrintSection, PrintRow } from "@/components/app/print-report";
import { downloadSimpleReportPdf } from "@/lib/pdf/simple-report";
import { BatchReassign } from "@/components/app/batch-reassign";

const PRODUCTS: { value: SaleProduct; label: string }[] = [
  { value: "eggs", label: "Eggs" },
  { value: "live_birds", label: "Live birds" },
  { value: "processed_birds", label: "Processed birds" },
  { value: "spent_layers", label: "Spent layers" },
  { value: "chicks", label: "Chicks" },
  { value: "manure", label: "Manure" },
  { value: "other", label: "Other" },
];

export function SalesManager({
  tenantId,
  flocks,
  defaultFlockId,
  currency,
  quickDailyTotalCents,
  sales,
  customers,
  tenantName,
  farmName,
}: {
  tenantId: string;
  flocks: Flock[];
  defaultFlockId: string | null;
  currency: string;
  quickDailyTotalCents: number;
  sales: (Sale & { poultryedos_customers: { name: string; phone: string | null } | null; poultryedos_flocks: { batch_code: string } | null })[];
  customers: Customer[];
  tenantName: string;
  farmName: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [flockId, setFlockId] = useState(defaultFlockId ?? "");
  const [product, setProduct] = useState<SaleProduct>("eggs");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("trays");
  const [unitPrice, setUnitPrice] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBatchFor, setEditingBatchFor] = useState<string | null>(null);

  const itemizedTotal = sales.reduce((sum, s) => sum + s.total_amount_cents, 0);
  const grandTotal = quickDailyTotalCents + itemizedTotal;
  const computedTotal = useMemo(() => {
    const q = Number(quantity) || 0;
    const p = Number(unitPrice) || 0;
    return Math.round(q * p * 100);
  }, [quantity, unitPrice]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    let resolvedCustomerId = customerId || null;
    if (!resolvedCustomerId && newCustomerName.trim()) {
      const { data, error } = await supabase
        .from("poultryedos_customers")
        .insert({
          tenant_id: tenantId,
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
        })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        setError(error?.message ?? "Could not create customer");
        return;
      }
      resolvedCustomerId = (data as { id: string }).id;
    }

    const { error } = await supabase.from("poultryedos_sales").insert({
      tenant_id: tenantId,
      flock_id: flockId || null,
      customer_id: resolvedCustomerId,
      product,
      quantity: Number(quantity),
      unit,
      unit_price_cents: Math.round(Number(unitPrice) * 100),
      total_amount_cents: computedTotal,
      payment_method: paymentMethod,
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setQuantity("");
    setUnitPrice("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setAdding(false);
    router.refresh();
  }

  function handleDownloadPdf() {
    downloadSimpleReportPdf({
      tenantName,
      subtitle: farmName,
      title: "Sales Summary",
      filename: "sales-summary.pdf",
      sections: [
        {
          title: "Totals (last 30 days)",
          rows: [
            ["Quick daily totals", formatMoney(quickDailyTotalCents, currency)],
            ["Itemized sales", formatMoney(itemizedTotal, currency)],
            ["Grand total", formatMoney(grandTotal, currency)],
          ],
        },
      ],
      table: {
        title: "Itemized sales",
        head: ["Date", "Batch", "Client", "Contacts", "Payment", "Qty", "Cost"],
        body: sales.map((s) => [
          new Date(s.sale_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
          s.poultryedos_flocks?.batch_code ?? "General",
          s.poultryedos_customers?.name ?? "Walk-in",
          s.poultryedos_customers?.phone ?? "—",
          s.payment_method,
          `${s.quantity} ${s.unit}`,
          formatMoney(s.total_amount_cents, currency),
        ]),
      },
    });
  }

  return (
    <div>
      <div className="print:hidden flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Sales</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
          >
            <Download className="h-4 w-4" /> PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
            >
              + Log a sale
            </button>
          )}
        </div>
      </div>

      <div className="print:hidden mt-4 rounded-2xl border border-line bg-paper-raised p-5">
        <p className="text-xs text-ink-faint">Total (last 30 days)</p>
        <p className="mt-1 font-display text-3xl font-medium text-ink">{formatMoney(grandTotal, currency)}</p>
        <div className="mt-3 flex justify-between text-xs text-ink-faint">
          <span>Quick daily totals: {formatMoney(quickDailyTotalCents, currency)}</span>
          <span>Itemized sales: {formatMoney(itemizedTotal, currency)}</span>
        </div>
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-line bg-paper-raised p-4">
          {flocks.length > 0 && (
            <div>
              <label className="text-sm font-medium text-ink-soft">Batch</label>
              <select
                value={flockId}
                onChange={(e) => setFlockId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">General (not batch-specific)</option>
                {flocks.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.batch_code} {f.status !== "active" ? `(${f.status.replace("_", " ")})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-ink-soft">Product</label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value as SaleProduct)}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {PRODUCTS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-ink-soft">Unit</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="trays, pieces, kg…"
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-soft">Quantity</label>
              <input
                type="number"
                required
                min={0}
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-soft">Unit price ({currency})</label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <p className="text-sm text-ink-soft">
            Total: <span className="font-medium text-ink">{formatMoney(computedTotal, currency)}</span>
          </p>

          <div>
            <label className="text-sm font-medium text-ink-soft">Customer (optional)</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">— None / walk-in —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!customerId && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="New customer name"
                  className="rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-ink-soft">Payment method</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["cash", "mpesa", "bank", "credit", "other"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
                    paymentMethod === m
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-line-strong text-ink-soft"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
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
              {busy ? "Saving…" : "Save sale"}
            </button>
          </div>
        </form>
      )}

      <div className="print:hidden mt-4 space-y-2">
        {sales.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No itemized sales yet. Quick daily totals from Record Today still count toward your total above.
          </p>
        )}
        {sales.map((s) => (
          <div key={s.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink capitalize">
                  {s.product.replace("_", " ")} · {s.quantity} {s.unit}
                </p>
                <p className="text-xs text-ink-faint">
                  {new Date(s.sale_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  {" · "}
                  {s.poultryedos_flocks?.batch_code ?? "General"}
                  {flocks.length > 0 && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => setEditingBatchFor(editingBatchFor === s.id ? null : s.id)}
                        className="text-primary hover:underline"
                      >
                        (change)
                      </button>
                    </>
                  )}
                  {s.poultryedos_customers && ` · ${s.poultryedos_customers.name}`}
                </p>
              </div>
              <span className="font-medium text-ink">{formatMoney(s.total_amount_cents, currency)}</span>
            </div>
            {editingBatchFor === s.id && (
              <BatchReassign
                currentFlockId={s.flock_id}
                flocks={flocks}
                onSave={async (newFlockId) => {
                  const supabase = createClient();
                  await supabase.from("poultryedos_sales").update({ flock_id: newFlockId }).eq("id", s.id);
                  setEditingBatchFor(null);
                  router.refresh();
                }}
                onCancel={() => setEditingBatchFor(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* ---------- Print / PDF report view ---------- */}
      <div className="hidden print:block print:text-black">
        <PrintHeader tenantName={tenantName} subtitle={farmName} title="Sales Summary" />

        <PrintSection title="Totals (last 30 days)">
          <PrintRow label="Quick daily totals" value={formatMoney(quickDailyTotalCents, currency)} />
          <PrintRow label="Itemized sales" value={formatMoney(itemizedTotal, currency)} />
          <PrintRow label="Grand total" value={formatMoney(grandTotal, currency)} />
        </PrintSection>

        <PrintSection title="Itemized sales">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/30 text-left">
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Batch</th>
                <th className="py-1 pr-2">Client</th>
                <th className="py-1 pr-2">Contacts</th>
                <th className="py-1 pr-2">Payment</th>
                <th className="py-1 pr-2">Qty</th>
                <th className="py-1">Cost</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-black/10">
                  <td className="py-1 pr-2">
                    {new Date(s.sale_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </td>
                  <td className="py-1 pr-2">{s.poultryedos_flocks?.batch_code ?? "General"}</td>
                  <td className="py-1 pr-2">{s.poultryedos_customers?.name ?? "Walk-in"}</td>
                  <td className="py-1 pr-2">{s.poultryedos_customers?.phone ?? "—"}</td>
                  <td className="py-1 pr-2 capitalize">{s.payment_method}</td>
                  <td className="py-1 pr-2">
                    {s.quantity} {s.unit}
                  </td>
                  <td className="py-1">{formatMoney(s.total_amount_cents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      </div>
    </div>
  );
}
