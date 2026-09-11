"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Flock, ActualPaymentMethod, PaymentMethod } from "@/lib/database.types";
import { type SaleWithDetails, saleBalanceCents, saleAmountPaidCents } from "@/lib/sales-helpers";
import { formatMoney } from "@/lib/money";
import { PrintHeader, PrintSection, PrintRow } from "@/components/app/print-report";
import { downloadSimpleReportPdf } from "@/lib/pdf/simple-report";
import { downloadSaleDocumentPdf } from "@/lib/pdf/sale-document";
import { BatchReassign } from "@/components/app/batch-reassign";
import { CartLineItems, PRODUCTS, emptyCartLine, cartTotals, cartToPayload, type CartLineDraft } from "@/components/app/cart-line-items";

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
  sales: SaleWithDetails[];
  customers: Customer[];
  tenantName: string;
  farmName: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [flockId, setFlockId] = useState(defaultFlockId ?? "");
  const [lines, setLines] = useState<CartLineDraft[]>([emptyCartLine()]);
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"full" | "partial" | "credit">("full");
  const [paymentMethod, setPaymentMethod] = useState<ActualPaymentMethod>("cash");
  const [partialAmount, setPartialAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBatchFor, setEditingBatchFor] = useState<string | null>(null);
  const [payingFor, setPayingFor] = useState<string | null>(null);

  const itemizedTotal = sales.reduce((sum, s) => sum + s.total_amount_cents, 0);
  const grandTotal = quickDailyTotalCents + itemizedTotal;
  const { subtotalCents, discountCents, totalCents } = cartTotals(lines);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    let resolvedCustomerId = customerId || null;
    if (!resolvedCustomerId && newCustomerName.trim()) {
      const { data, error } = await supabase
        .from("poultryedos_customers")
        .insert({ tenant_id: tenantId, name: newCustomerName.trim(), phone: newCustomerPhone.trim() || null })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        setError(error?.message ?? "Could not create customer");
        return;
      }
      resolvedCustomerId = (data as { id: string }).id;
    }

    const amountPaidNowCents =
      paymentChoice === "full" ? totalCents : paymentChoice === "partial" ? Math.round(Number(partialAmount) * 100) : 0;
    const effectivePaymentMethod: PaymentMethod = paymentChoice === "credit" ? "credit" : paymentMethod;

    const { error } = await supabase.rpc("poultryedos_create_sale", {
      p_tenant_id: tenantId,
      p_flock_id: flockId || null,
      p_customer_id: resolvedCustomerId,
      p_items: cartToPayload(lines),
      p_amount_paid_now_cents: amountPaidNowCents,
      p_payment_method: effectivePaymentMethod,
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setLines([emptyCartLine()]);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setPartialAmount("");
    setAdding(false);
    router.refresh();
  }

  async function submitPayment(saleId: string, amountCents: number, method: ActualPaymentMethod) {
    const supabase = createClient();
    const { error } = await supabase.rpc("poultryedos_record_sale_payment", {
      p_sale_id: saleId,
      p_amount_cents: amountCents,
      p_method: method,
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    setPayingFor(null);
    router.refresh();
  }

  function downloadDocument(sale: SaleWithDetails) {
    const balance = saleBalanceCents(sale);
    const kind = balance <= 0 ? "receipt" : "invoice";
    downloadSaleDocumentPdf({
      kind,
      tenantName,
      farmName,
      documentNumber: sale.id.slice(0, 8).toUpperCase(),
      date: new Date(sale.sale_date).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }),
      currency,
      billTo: { name: sale.poultryedos_customers?.name ?? "Walk-in customer", phone: sale.poultryedos_customers?.phone },
      lines: sale.poultryedos_sale_items.map((i) => ({
        description: PRODUCTS.find((p) => p.value === i.product)?.label ?? i.product,
        quantity: `${i.quantity} ${i.unit}`,
        unitPrice: i.unit_price_cents,
        lineTotal: i.line_total_cents,
      })),
      subtotalCents: sale.poultryedos_sale_items.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0),
      discountCents: sale.poultryedos_sale_items.reduce((s, i) => s + i.discount_cents, 0),
      totalCents: sale.total_amount_cents,
      amountPaidCents: saleAmountPaidCents(sale),
      filename: `${kind}-${sale.id.slice(0, 8)}.pdf`,
    });
  }

  function handleDownloadPdf() {
    const allItems = sales.flatMap((s) => s.poultryedos_sale_items.map((i) => ({ sale: s, item: i })));
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
        head: ["Date", "Batch", "Client", "Product", "Qty", "Payment", "Cost"],
        body: allItems.map(({ sale, item }) => [
          new Date(sale.sale_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
          sale.poultryedos_flocks?.batch_code ?? "General",
          sale.poultryedos_customers?.name ?? "Walk-in",
          PRODUCTS.find((p) => p.value === item.product)?.label ?? item.product,
          `${item.quantity} ${item.unit}`,
          sale.payment_method,
          formatMoney(item.line_total_cents, currency),
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
              + New sale
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

          <CartLineItems lines={lines} onChange={setLines} />

          <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm">
            <span className="text-ink-faint">
              Subtotal {formatMoney(subtotalCents, currency)}
              {discountCents > 0 && ` · Discount -${formatMoney(discountCents, currency)}`}
            </span>
            <span className="font-medium text-ink">Total {formatMoney(totalCents, currency)}</span>
          </div>

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
            <label className="text-sm font-medium text-ink-soft">Payment</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  ["full", "Paid in full now"],
                  ["partial", "Partial payment now"],
                  ["credit", "On credit (pay later)"],
                ] as [typeof paymentChoice, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentChoice(value)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    paymentChoice === value ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {paymentChoice !== "credit" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(["cash", "mpesa", "bank", "other"] as ActualPaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
                      paymentMethod === m ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {paymentChoice === "partial" && (
              <input
                type="number"
                required
                min={0.01}
                max={totalCents / 100}
                step="0.01"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                placeholder={`Amount paid now (${currency})`}
                className="mt-2 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
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
              {busy ? "Saving…" : "Complete sale"}
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
        {sales.map((s) => {
          const balance = saleBalanceCents(s);
          return (
            <div key={s.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink capitalize">
                    {s.poultryedos_sale_items
                      .map((i) => `${i.product.replace("_", " ")} (${i.quantity} ${i.unit})`)
                      .join(", ")}
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
                <div className="shrink-0 text-right">
                  <span className="font-medium text-ink">{formatMoney(s.total_amount_cents, currency)}</span>
                  {balance > 0 && <p className="text-xs text-danger">Balance {formatMoney(balance, currency)}</p>}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => downloadDocument(s)}
                  className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft hover:border-primary"
                >
                  {balance <= 0 ? "Download Receipt" : "Download Invoice"}
                </button>
                {balance > 0 && (
                  <button
                    type="button"
                    onClick={() => setPayingFor(payingFor === s.id ? null : s.id)}
                    className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft hover:border-primary"
                  >
                    Record payment
                  </button>
                )}
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

              {payingFor === s.id && <RecordPaymentPanel balanceCents={balance} onSave={(amt, method) => submitPayment(s.id, amt, method)} onCancel={() => setPayingFor(null)} />}
            </div>
          );
        })}
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
                <th className="py-1 pr-2">Product</th>
                <th className="py-1 pr-2">Payment</th>
                <th className="py-1 pr-2">Qty</th>
                <th className="py-1">Cost</th>
              </tr>
            </thead>
            <tbody>
              {sales.flatMap((s) =>
                s.poultryedos_sale_items.map((item) => (
                  <tr key={item.id} className="border-b border-black/10">
                    <td className="py-1 pr-2">
                      {new Date(s.sale_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                    </td>
                    <td className="py-1 pr-2">{s.poultryedos_flocks?.batch_code ?? "General"}</td>
                    <td className="py-1 pr-2">{s.poultryedos_customers?.name ?? "Walk-in"}</td>
                    <td className="py-1 pr-2 capitalize">{item.product.replace("_", " ")}</td>
                    <td className="py-1 pr-2 capitalize">{s.payment_method}</td>
                    <td className="py-1 pr-2">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1">{formatMoney(item.line_total_cents, currency)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </PrintSection>
      </div>
    </div>
  );
}

function RecordPaymentPanel({
  balanceCents,
  onSave,
  onCancel,
}: {
  balanceCents: number;
  onSave: (amountCents: number, method: ActualPaymentMethod) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(String(balanceCents / 100));
  const [method, setMethod] = useState<ActualPaymentMethod>("cash");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-2 space-y-2 border-t border-line pt-2">
      <div className="flex flex-wrap gap-2">
        {(["cash", "mpesa", "bank", "other"] as ActualPaymentMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${
              method === m ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0.01}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 rounded-lg border border-line-strong px-2 py-1.5 text-xs outline-none focus:border-primary"
        />
        <button type="button" onClick={onCancel} className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(Math.round(Number(amount) * 100), method);
            setBusy(false);
          }}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
