"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Flock, MarketplaceCategory, MarketplaceListing, MarketplaceListingStatus } from "@/lib/database.types";
import { formatMoney } from "@/lib/money";

const CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  eggs: "Eggs",
  birds: "Birds",
  manure: "Manure",
  feed_request: "Feed wanted",
  other: "Other",
};

const STATUS_STYLES: Record<MarketplaceListingStatus, string> = {
  active: "bg-success-soft text-success",
  fulfilled: "bg-accent-soft text-accent-dark",
  expired: "bg-line text-ink-faint",
  cancelled: "bg-line text-ink-faint",
};

type ListingRow = MarketplaceListing & { poultryedos_flocks: { batch_code: string } | null };

export function MarketplaceManager({
  tenantId,
  farmId,
  flocks,
  defaultContactName,
  defaultContactPhone,
  listings,
}: {
  tenantId: string;
  farmId: string;
  flocks: Flock[];
  defaultContactName: string;
  defaultContactPhone: string;
  listings: ListingRow[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<MarketplaceCategory>("eggs");
  const [flockId, setFlockId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [negotiable, setNegotiable] = useState(true);
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [contactName, setContactName] = useState(defaultContactName);
  const [contactPhone, setContactPhone] = useState(defaultContactPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_marketplace_listings").insert({
      tenant_id: tenantId,
      farm_id: farmId,
      flock_id: category === "birds" ? flockId || null : null,
      category,
      title,
      description: description || null,
      quantity: quantity === "" ? null : Number(quantity),
      unit: unit || null,
      price_cents: negotiable || price === "" ? null : Math.round(Number(price) * 100),
      location: location || null,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setTitle("");
    setDescription("");
    setQuantity("");
    setUnit("");
    setPrice("");
    setLocation("");
    setAdding(false);
    router.refresh();
  }

  async function setStatus(id: string, status: MarketplaceListingStatus) {
    const supabase = createClient();
    await supabase.from("poultryedos_marketplace_listings").update({ status }).eq("id", id);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-soft">My listings</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
          >
            + New listing
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-4 rounded-xl border border-line bg-paper-raised p-4">
          <div>
            <label className="text-sm font-medium text-ink-soft">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MarketplaceCategory)}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {category === "birds" && flocks.length > 0 && (
            <div>
              <label className="text-sm font-medium text-ink-soft">Batch</label>
              <select
                value={flockId}
                onChange={(e) => setFlockId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Not tied to a specific batch</option>
                {flocks.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.batch_code}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-ink-soft">Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 50 trays of fresh eggs"
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink-soft">Details (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-ink-soft">Quantity</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-soft">Unit</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="trays, birds, bags..."
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
              <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} />
              Price negotiable
            </label>
            {!negotiable && (
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price (KES)"
                className="mt-2 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-ink-soft">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Kiambu, near Ruiru"
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-ink-soft">Contact name</label>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-soft">Contact phone</label>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <p className="text-xs text-ink-faint">
            This listing (including your name and phone) will be visible publicly on the Poultry360 Marketplace,
            without requiring anyone to sign in — same as any classified ad.
          </p>

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
              {busy ? "Publishing…" : "Publish listing"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {listings.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            You haven&apos;t listed anything yet.
          </p>
        )}
        {listings.map((l) => (
          <div key={l.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[l.status]}`}>
                    {l.status}
                  </span>
                  <span className="text-xs text-ink-faint">{CATEGORY_LABELS[l.category]}</span>
                </div>
                <p className="mt-1 font-medium text-ink">{l.title}</p>
                <p className="text-xs text-ink-faint">
                  {l.poultryedos_flocks?.batch_code && `${l.poultryedos_flocks.batch_code} · `}
                  Expires {new Date(l.expires_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </p>
              </div>
              <span className="shrink-0 font-medium text-ink">
                {l.price_cents != null ? formatMoney(l.price_cents, "KES") : "Negotiable"}
              </span>
            </div>
            {l.status === "active" && (
              <div className="mt-2 flex gap-2 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => setStatus(l.id, "fulfilled")}
                  className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft hover:border-primary"
                >
                  Mark fulfilled
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(l.id, "cancelled")}
                  className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft hover:border-primary"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
