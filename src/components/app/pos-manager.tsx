"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Flock, ActualPaymentMethod, PaymentMethod } from "@/lib/database.types";
import { formatMoney } from "@/lib/money";
import { downloadSaleDocumentPdf } from "@/lib/pdf/sale-document";
import { CartLineItems, PRODUCTS, emptyCartLine, cartTotals, cartToPayload, type CartLineDraft } from "@/components/app/cart-line-items";

interface CompletedSale {
  saleId: string;
  kind: "receipt" | "invoice";
  customerName: string;
  customerPhone: string | null;
  lines: CartLineDraft[];
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  amountPaidCents: number;
}

/** The dedicated checkout screen -- same cart mechanics as the Sales
 * page's "+ New sale" panel, but full-page and ending in an immediate
 * receipt/invoice download for the transaction just completed. */
export function PosManager({
  tenantId,
  farmName,
  tenantName,
  flocks,
  defaultFlockId,
  currency,
  customers,
}: {
  tenantId: string;
  farmName: string;
  tenantName: string;
  flocks: Flock[];
  defaultFlockId: string | null;
  currency: string;
  customers: Customer[];
}) {
  const router = useRouter();
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
  const [completed, setCompleted] = useState<CompletedSale | null>(null);

  const { subtotalCents, discountCents, totalCents } = cartTotals(lines);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    let resolvedCustomerId = customerId || null;
    let resolvedCustomerName = customers.find((c) => c.id === customerId)?.name ?? "Walk-in customer";
    let resolvedCustomerPhone = customers.find((c) => c.id === customerId)?.phone ?? null;
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
      resolvedCustomerName = newCustomerName.trim();
      resolvedCustomerPhone = newCustomerPhone.trim() || null;
    }

    const amountPaidNowCents =
      paymentChoice === "full" ? totalCents : paymentChoice === "partial" ? Math.round(Number(partialAmount) * 100) : 0;
    const effectivePaymentMethod: PaymentMethod = paymentChoice === "credit" ? "credit" : paymentMethod;

    const { data: saleId, error } = await supabase.rpc("poultryedos_create_sale", {
      p_tenant_id: tenantId,
      p_flock_id: flockId || null,
      p_customer_id: resolvedCustomerId,
      p_items: cartToPayload(lines),
      p_amount_paid_now_cents: amountPaidNowCents,
      p_payment_method: effectivePaymentMethod,
    });

    setBusy(false);
    if (error || !saleId) {
      setError(error?.message ?? "Could not complete the sale");
      return;
    }

    setCompleted({
      saleId: saleId as string,
      kind: amountPaidNowCents >= totalCents ? "receipt" : "invoice",
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      lines,
      totalCents,
      subtotalCents,
      discountCents,
      amountPaidCents: amountPaidNowCents,
    });
  }

  function downloadCompleted() {
    if (!completed) return;
    downloadSaleDocumentPdf({
      kind: completed.kind,
      tenantName,
      farmName,
      documentNumber: completed.saleId.slice(0, 8).toUpperCase(),
      date: new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }),
      currency,
      billTo: { name: completed.customerName, phone: completed.customerPhone },
      lines: completed.lines.map((l) => ({
        description: PRODUCTS.find((p) => p.value === l.product)?.label ?? l.product,
        quantity: `${l.quantity} ${l.unit}`,
        unitPrice: Math.round(Number(l.unitPrice) * 100),
        lineTotal: Math.round(Number(l.quantity) * Number(l.unitPrice) * 100) - Math.round((Number(l.discount) || 0) * 100),
      })),
      subtotalCents: completed.subtotalCents,
      discountCents: completed.discountCents,
      totalCents: completed.totalCents,
      amountPaidCents: completed.amountPaidCents,
      filename: `${completed.kind}-${completed.saleId.slice(0, 8)}.pdf`,
    });
  }

  function startNewSale() {
    setCompleted(null);
    setLines([emptyCartLine()]);
    setCustomerId("");
    setNewCustomerName("");
    setNewCustomerPhone("");
    setPartialAmount("");
    setPaymentChoice("full");
    router.refresh();
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="mt-8 rounded-2xl border border-line bg-paper-raised p-8">
          <p className="font-display text-2xl font-medium text-ink">Sale complete</p>
          <p className="mt-1 text-sm text-ink-soft">
            {formatMoney(completed.totalCents, currency)} · {completed.customerName}
          </p>
          {completed.kind === "invoice" && (
            <p className="mt-2 text-sm text-danger">
              Balance due: {formatMoney(completed.totalCents - completed.amountPaidCents, currency)}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={downloadCompleted}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark"
            >
              Download {completed.kind === "invoice" ? "Invoice" : "Receipt"}
            </button>
            <button
              type="button"
              onClick={startNewSale}
              className="rounded-full border border-line-strong px-5 py-2.5 text-sm font-medium text-ink-soft"
            >
              New sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Point of Sale</h1>
      <p className="mt-1 text-sm text-ink-soft">Sell to a client and generate a receipt or invoice.</p>

      <form onSubmit={handleCheckout} className="mt-4 space-y-4 rounded-xl border border-line bg-paper-raised p-4">
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
          <span className="font-display text-lg font-medium text-ink">{formatMoney(totalCents, currency)}</span>
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

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {busy ? "Completing…" : `Complete sale · ${formatMoney(totalCents, currency)}`}
        </button>
      </form>
    </div>
  );
}
