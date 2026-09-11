"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { InventoryCategory, InventoryItem, Supplier } from "@/lib/database.types";
import type { PurchaseOrderWithDetails } from "@/lib/data/business";
import { formatMoney } from "@/lib/money";

type Tab = "stock" | "purchases";

export function InventoryManager({
  tenantId,
  currency,
  items,
  suppliers,
  purchaseOrders,
}: {
  tenantId: string;
  currency: string;
  items: InventoryItem[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrderWithDetails[];
}) {
  const [tab, setTab] = useState<Tab>("stock");

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Inventory &amp; purchases</h1>

      <div className="mt-4 flex gap-2">
        <TabButton active={tab === "stock"} onClick={() => setTab("stock")}>
          Stock
        </TabButton>
        <TabButton active={tab === "purchases"} onClick={() => setTab("purchases")}>
          Purchases
        </TabButton>
      </div>

      {tab === "stock" ? (
        <StockTab tenantId={tenantId} items={items} />
      ) : (
        <PurchasesTab tenantId={tenantId} currency={currency} suppliers={suppliers} items={items} purchaseOrders={purchaseOrders} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm ${
        active ? "border-primary bg-primary-soft text-primary" : "border-line-strong text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

function StockTab({ tenantId, items }: { tenantId: string; items: InventoryItem[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("feed");
  const [unit, setUnit] = useState("kg");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState<string | null>(null);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_inventory_items").insert({
      tenant_id: tenantId,
      name,
      category,
      unit,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-soft">Items</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
          >
            + Add item
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAddItem} className="mt-3 space-y-3 rounded-xl border border-line bg-paper-raised p-4">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Layer feed"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as InventoryCategory)}
              className="rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="feed">Feed</option>
              <option value="vaccine">Vaccine</option>
              <option value="medicine">Medicine</option>
              <option value="equipment">Equipment</option>
              <option value="other">Other</option>
            </select>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg, litre, dose…"
              className="rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {items.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No inventory items yet.
          </p>
        )}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{item.name}</p>
                <p className="text-xs text-ink-faint capitalize">{item.category}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-medium text-ink">
                  {item.stock_on_hand} {item.unit}
                </p>
                {item.reorder_level != null && item.stock_on_hand <= item.reorder_level && (
                  <p className="text-xs text-warning">Low stock</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLogging(logging === item.id ? null : item.id)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              {logging === item.id ? "Cancel" : "Log usage / adjustment"}
            </button>
            {logging === item.id && (
              <LogTransactionForm tenantId={tenantId} itemId={item.id} onDone={() => setLogging(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LogTransactionForm({ tenantId, itemId, onDone }: { tenantId: string; itemId: string; onDone: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<"out" | "adjustment">("out");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const qty = Number(quantity);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_inventory_transactions").insert({
      tenant_id: tenantId,
      item_id: itemId,
      transaction_type: type,
      quantity: type === "adjustment" ? qty : Math.abs(qty),
      reference: type === "adjustment" ? "manual_adjustment" : "manual_use",
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-end gap-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as "out" | "adjustment")}
        className="rounded-lg border border-line-strong px-2 py-1.5 text-sm outline-none focus:border-primary"
      >
        <option value="out">Used</option>
        <option value="adjustment">Adjustment (+/-)</option>
      </select>
      <input
        type="number"
        required
        step="0.1"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder={type === "adjustment" ? "e.g. -2" : "e.g. 10"}
        className="w-28 rounded-lg border border-line-strong px-2 py-1.5 text-sm outline-none focus:border-primary"
      />
      <button type="submit" disabled={busy} className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-paper disabled:opacity-60">
        {busy ? "Saving…" : "Save"}
      </button>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </form>
  );
}

interface DraftLine {
  itemId: string;
  itemName: string;
  quantity: string;
  unitCost: string;
}

function emptyLine(): DraftLine {
  return { itemId: "", itemName: "", quantity: "", unitCost: "" };
}

function PurchasesTab({
  tenantId,
  currency,
  suppliers,
  items,
  purchaseOrders,
}: {
  tenantId: string;
  currency: string;
  suppliers: Supplier[];
  items: InventoryItem[];
  purchaseOrders: PurchaseOrderWithDetails[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const orderTotalCents = lines.reduce((sum, l) => sum + Math.round((Number(l.quantity) || 0) * (Number(l.unitCost) || 0) * 100), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    let resolvedSupplierId = supplierId || null;
    if (!resolvedSupplierId && newSupplierName.trim()) {
      const { data, error } = await supabase
        .from("poultryedos_suppliers")
        .insert({ tenant_id: tenantId, name: newSupplierName.trim() })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        setError(error?.message ?? "Could not create supplier");
        return;
      }
      resolvedSupplierId = (data as { id: string }).id;
    }

    const payloadItems = lines.map((l) => {
      const selectedItem = items.find((i) => i.id === l.itemId);
      return {
        item_id: l.itemId || null,
        item_name: selectedItem?.name ?? l.itemName,
        quantity: Number(l.quantity),
        unit_cost_cents: Math.round(Number(l.unitCost) * 100),
      };
    });

    const { error } = await supabase.rpc("poultryedos_create_purchase_order", {
      p_tenant_id: tenantId,
      p_supplier_id: resolvedSupplierId,
      p_items: payloadItems,
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setLines([emptyLine()]);
    setNewSupplierName("");
    setAdding(false);
    router.refresh();
  }

  async function markReceived(id: string) {
    const supabase = createClient();
    await supabase
      .from("poultryedos_purchase_orders")
      .update({ status: "received", received_date: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    router.refresh();
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-soft">Purchase orders</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
          >
            + New order
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-xl border border-line bg-paper-raised p-4">
          <div>
            <label className="text-sm font-medium text-ink-soft">Supplier</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">— None / new —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {!supplierId && (
              <input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Or type a new supplier name"
                className="mt-2 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
          </div>

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
                <select
                  value={line.itemId}
                  onChange={(e) => updateLine(index, { itemId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">— Not tracked in inventory —</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                {!line.itemId && (
                  <input
                    value={line.itemName}
                    onChange={(e) => updateLine(index, { itemName: e.target.value })}
                    placeholder="What are you buying?"
                    className="mt-2 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                )}
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-ink-faint">Quantity</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="0.1"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-faint">Unit cost ({currency})</label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="0.01"
                      value={line.unitCost}
                      onChange={(e) => updateLine(index, { unitCost: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> Add another item
          </button>

          <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm">
            <span className="text-ink-faint">Order total</span>
            <span className="font-medium text-ink">{formatMoney(orderTotalCents, currency)}</span>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {purchaseOrders.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No purchase orders yet.
          </p>
        )}
        {purchaseOrders.map((po) => (
          <div key={po.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-ink">
                  {po.poultryedos_purchase_order_items.length}{" "}
                  {po.poultryedos_purchase_order_items.length === 1 ? "item" : "items"}
                  {po.poultryedos_suppliers && ` · ${po.poultryedos_suppliers.name}`}
                </p>
                <p className="mt-1 text-xs text-ink-faint">
                  {po.poultryedos_purchase_order_items.map((i) => `${i.item_name} (${i.quantity})`).join(", ")}
                </p>
              </div>
              {po.status === "ordered" ? (
                <button
                  type="button"
                  onClick={() => markReceived(po.id)}
                  className="shrink-0 rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:border-primary"
                >
                  Mark received
                </button>
              ) : (
                <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs capitalize text-success">{po.status}</span>
              )}
            </div>
            <p className="mt-2 font-medium text-ink">{formatMoney(po.total_cost_cents, currency)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
