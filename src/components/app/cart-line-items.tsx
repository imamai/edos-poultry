"use client";

import { X, Plus } from "lucide-react";
import type { CartLine, SaleProduct } from "@/lib/database.types";

export const PRODUCTS: { value: SaleProduct; label: string }[] = [
  { value: "eggs", label: "Eggs" },
  { value: "live_birds", label: "Live birds" },
  { value: "processed_birds", label: "Processed birds" },
  { value: "spent_layers", label: "Spent layers" },
  { value: "chicks", label: "Chicks" },
  { value: "manure", label: "Manure" },
  { value: "other", label: "Other" },
];

export interface CartLineDraft {
  product: SaleProduct;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

export function emptyCartLine(): CartLineDraft {
  return { product: "eggs", unit: "trays", quantity: "", unitPrice: "", discount: "" };
}

/** Shared by the Sales page's "+ New sale" panel, /app/pos, and
 * /app/quotations -- one repeatable line-item cart, same interaction as
 * PurchasesTab's line items (src/components/app/inventory-manager.tsx). */
export function CartLineItems({ lines, onChange }: { lines: CartLineDraft[]; onChange: (lines: CartLineDraft[]) => void }) {
  function updateLine(index: number, patch: Partial<CartLineDraft>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    onChange([...lines, emptyCartLine()]);
  }
  function removeLine(index: number) {
    if (lines.length > 1) onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div key={index} className="rounded-lg border border-line-strong p-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-ink-faint">Item {index + 1}</label>
            {lines.length > 1 && (
              <button type="button" onClick={() => removeLine(index)} className="text-ink-faint hover:text-danger">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <select
              value={line.product}
              onChange={(e) => updateLine(index, { product: e.target.value as SaleProduct })}
              className="rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {PRODUCTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              value={line.unit}
              onChange={(e) => updateLine(index, { unit: e.target.value })}
              placeholder="trays, pieces, kg…"
              className="rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-ink-faint">Quantity</label>
              <input
                type="number"
                required
                min={0.01}
                step="0.1"
                value={line.quantity}
                onChange={(e) => updateLine(index, { quantity: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-ink-faint">Unit price</label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={line.unitPrice}
                onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-ink-faint">Discount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.discount}
                onChange={(e) => updateLine(index, { discount: e.target.value })}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={addLine} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
        <Plus className="h-4 w-4" /> Add another item
      </button>
    </div>
  );
}

export function cartTotals(lines: CartLineDraft[]) {
  let subtotalCents = 0;
  let discountCents = 0;
  for (const l of lines) {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const disc = Math.round((Number(l.discount) || 0) * 100);
    subtotalCents += Math.round(qty * price * 100);
    discountCents += disc;
  }
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}

export function cartToPayload(lines: CartLineDraft[]): CartLine[] {
  return lines.map((l) => ({
    product: l.product,
    quantity: Number(l.quantity),
    unit: l.unit || "piece",
    unit_price_cents: Math.round(Number(l.unitPrice) * 100),
    discount_cents: Math.round((Number(l.discount) || 0) * 100),
  }));
}
