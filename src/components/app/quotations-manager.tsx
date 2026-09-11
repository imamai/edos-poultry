"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Flock, ActualPaymentMethod, PaymentMethod, QuotationStatus } from "@/lib/database.types";
import type { QuotationWithItems } from "@/lib/data/quotations";
import { formatMoney } from "@/lib/money";
import { downloadSaleDocumentPdf } from "@/lib/pdf/sale-document";
import { CartLineItems, PRODUCTS, emptyCartLine, cartTotals, cartToPayload, type CartLineDraft } from "@/components/app/cart-line-items";

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: "bg-line text-ink-faint",
  sent: "bg-accent-soft text-accent-dark",
  accepted: "bg-success-soft text-success",
  declined: "bg-danger-soft text-danger",
  expired: "bg-line text-ink-faint",
  converted: "bg-success-soft text-success",
};

export function QuotationsManager({
  tenantId,
  farmId,
  farmName,
  tenantName,
  flocks,
  defaultFlockId,
  currency,
  customers,
  quotations,
}: {
  tenantId: string;
  farmId: string;
  farmName: string;
  tenantName: string;
  flocks: Flock[];
  defaultFlockId: string | null;
  currency: string;
  customers: Customer[];
  quotations: QuotationWithItems[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [lines, setLines] = useState<CartLineDraft[]>([emptyCartLine()]);
  const [customerId, setCustomerId] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const { subtotalCents, discountCents, totalCents } = cartTotals(lines);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.rpc("poultryedos_create_quotation", {
      p_tenant_id: tenantId,
      p_farm_id: farmId,
      p_customer_id: customerId || null,
      p_prospect_name: customerId ? null : prospectName || null,
      p_prospect_phone: customerId ? null : prospectPhone || null,
      p_valid_until: validUntil || null,
      p_items: cartToPayload(lines),
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setLines([emptyCartLine()]);
    setProspectName("");
    setProspectPhone("");
    setValidUntil("");
    setAdding(false);
    router.refresh();
  }

  function downloadQuotation(q: QuotationWithItems) {
    downloadSaleDocumentPdf({
      kind: "quotation",
      tenantName,
      farmName,
      documentNumber: q.id.slice(0, 8).toUpperCase(),
      date: new Date(q.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }),
      currency,
      billTo: { name: q.poultryedos_customers?.name ?? q.prospect_name ?? "Prospect", phone: q.poultryedos_customers?.phone ?? q.prospect_phone },
      lines: q.poultryedos_quotation_items.map((i) => ({
        description: PRODUCTS.find((p) => p.value === i.product)?.label ?? i.product,
        quantity: `${i.quantity} ${i.unit}`,
        unitPrice: i.unit_price_cents,
        lineTotal: i.line_total_cents,
      })),
      subtotalCents: q.poultryedos_quotation_items.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0),
      discountCents: q.poultryedos_quotation_items.reduce((s, i) => s + i.discount_cents, 0),
      totalCents: q.total_amount_cents,
      validUntil: q.valid_until ? new Date(q.valid_until).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : undefined,
      filename: `quotation-${q.id.slice(0, 8)}.pdf`,
    });
  }

  async function setStatus(id: string, status: QuotationStatus) {
    const supabase = createClient();
    await supabase.from("poultryedos_quotations").update({ status }).eq("id", id);
    router.refresh();
  }

  async function convert(id: string, method: ActualPaymentMethod, paidNow: boolean, flockId: string) {
    const supabase = createClient();
    const q = quotations.find((x) => x.id === id);
    const { error } = await supabase.rpc("poultryedos_convert_quotation_to_sale", {
      p_quotation_id: id,
      p_flock_id: flockId || null,
      p_amount_paid_now_cents: paidNow ? (q?.total_amount_cents ?? 0) : 0,
      p_payment_method: (paidNow ? method : "credit") as PaymentMethod,
    });
    if (error) {
      window.alert(error.message);
      return;
    }
    setConvertingId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Quotations</h1>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
          >
            + New quotation
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-line bg-paper-raised p-4">
          <div>
            <label className="text-sm font-medium text-ink-soft">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">— A new prospect —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!customerId && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  placeholder="Prospect name"
                  className="rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <input
                  value={prospectPhone}
                  onChange={(e) => setProspectPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          <CartLineItems lines={lines} onChange={setLines} />

          <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm">
            <span className="text-ink-faint">
              Subtotal {formatMoney(subtotalCents, currency)}
              {discountCents > 0 && ` · Discount -${formatMoney(discountCents, currency)}`}
            </span>
            <span className="font-medium text-ink">Total {formatMoney(totalCents, currency)}</span>
          </div>

          <div>
            <label className="text-sm font-medium text-ink-soft">Valid until (optional)</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-line-strong px-5 py-2.5 text-sm font-medium text-ink-soft">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
              {busy ? "Saving…" : "Save quotation"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {quotations.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">No quotations yet.</p>
        )}
        {quotations.map((q) => (
          <div key={q.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[q.status]}`}>{q.status}</span>
                  <span className="text-xs text-ink-faint">{q.poultryedos_customers?.name ?? q.prospect_name ?? "Prospect"}</span>
                </div>
                <p className="mt-1 text-ink">
                  {q.poultryedos_quotation_items.map((i) => `${i.product.replace("_", " ")} (${i.quantity} ${i.unit})`).join(", ")}
                </p>
                {q.valid_until && (
                  <p className="text-xs text-ink-faint">
                    Valid until {new Date(q.valid_until).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-medium text-ink">{formatMoney(q.total_amount_cents, currency)}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">
              <button type="button" onClick={() => downloadQuotation(q)} className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft hover:border-primary">
                Download PDF
              </button>
              {q.status === "draft" && (
                <button type="button" onClick={() => setStatus(q.id, "sent")} className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft hover:border-primary">
                  Mark sent
                </button>
              )}
              {(q.status === "draft" || q.status === "sent") && (
                <>
                  <button type="button" onClick={() => setConvertingId(convertingId === q.id ? null : q.id)} className="rounded-full border border-success px-3 py-1 text-xs text-success hover:bg-success-soft">
                    Convert to sale
                  </button>
                  <button type="button" onClick={() => setStatus(q.id, "declined")} className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft hover:border-primary">
                    Declined
                  </button>
                </>
              )}
            </div>

            {convertingId === q.id && <ConvertPanel flocks={flocks} defaultFlockId={defaultFlockId} onConfirm={(method, paidNow, flockId) => convert(q.id, method, paidNow, flockId)} onCancel={() => setConvertingId(null)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConvertPanel({
  flocks,
  defaultFlockId,
  onConfirm,
  onCancel,
}: {
  flocks: Flock[];
  defaultFlockId: string | null;
  onConfirm: (method: ActualPaymentMethod, paidNow: boolean, flockId: string) => void;
  onCancel: () => void;
}) {
  const [flockId, setFlockId] = useState(defaultFlockId ?? "");
  const [paidNow, setPaidNow] = useState(true);
  const [method, setMethod] = useState<ActualPaymentMethod>("cash");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-2 space-y-2 border-t border-line pt-2">
      {flocks.length > 0 && (
        <select value={flockId} onChange={(e) => setFlockId(e.target.value)} className="w-full rounded-lg border border-line-strong px-2 py-1.5 text-xs outline-none focus:border-primary">
          <option value="">General (not batch-specific)</option>
          {flocks.map((f) => (
            <option key={f.id} value={f.id}>
              {f.batch_code}
            </option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
        Paid in full now
      </label>
      {paidNow && (
        <div className="flex flex-wrap gap-2">
          {(["cash", "mpesa", "bank", "other"] as ActualPaymentMethod[]).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} className={`rounded-full border px-3 py-1 text-xs capitalize ${method === m ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"}`}>
              {m}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm(method, paidNow, flockId);
            setBusy(false);
          }}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {busy ? "Converting…" : "Confirm sale"}
        </button>
      </div>
    </div>
  );
}
