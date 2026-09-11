"use client";

import { useState } from "react";
import type { MarketplaceBrowseRow, MarketplaceCategory } from "@/lib/database.types";
import { formatMoney } from "@/lib/money";

const CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  eggs: "Eggs",
  birds: "Birds",
  manure: "Manure",
  feed_request: "Feed wanted",
  other: "Other",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MarketplaceCategory[];

/** Shared browse UI for both /marketplace (public, signed-out visitors)
 * and /app/marketplace (signed-in tenant members) -- same data, same
 * rendering, so the two views can never disagree with each other. */
export function MarketplaceBoard({ listings }: { listings: MarketplaceBrowseRow[] }) {
  const [filter, setFilter] = useState<MarketplaceCategory | "all">("all");
  const filtered = filter === "all" ? listings : listings.filter((l) => l.category === filter);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            filter === "all" ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-soft hover:border-primary"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              filter === c ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-soft hover:border-primary"
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No listings here yet.
          </p>
        )}
        {filtered.map((l) => (
          <div key={l.id} className="rounded-xl border border-line bg-paper-raised p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-dark">
                  {CATEGORY_LABELS[l.category]}
                </span>
                <p className="mt-1.5 font-medium text-ink">{l.title}</p>
              </div>
              <p className="shrink-0 text-right font-display text-lg font-medium text-ink">
                {l.price_cents != null ? formatMoney(l.price_cents, "KES") : "Negotiable"}
              </p>
            </div>
            {l.description && <p className="mt-1.5 text-sm text-ink-soft">{l.description}</p>}
            <p className="mt-2 text-xs text-ink-faint">
              {[
                l.quantity != null ? `${l.quantity} ${l.unit ?? ""}`.trim() : null,
                l.location,
                `Listed by ${l.seller_name}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {l.contact_phone && (
              <a
                href={`tel:${l.contact_phone}`}
                className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
              >
                Call {l.contact_phone}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
