"use client";

import type { PoultryType } from "@/lib/database.types";

export interface FlockFormValues {
  poultryTypeId: string;
  batchCode: string;
  placementDate: string;
  initialQuantity: string;
  breed: string;
  supplier: string;
  source: string;
}

/** Shared field set for creating a flock — used by both onboarding's flock
 * step and the standalone "Add flock" page, so a batch created either way
 * captures the same real-world detail (breed / who supplied the chicks /
 * where they were actually picked up from — see PRODUCT_SPEC.md §18 and
 * the audit note in migration 0016 on why these are three separate
 * fields, not one). */
export function FlockFormFields({
  values,
  onChange,
  poultryTypes,
}: {
  values: FlockFormValues;
  onChange: (patch: Partial<FlockFormValues>) => void;
  poultryTypes: PoultryType[];
}) {
  return (
    <>
      <div>
        <label className="text-sm font-medium text-ink-soft">Poultry type</label>
        <select
          value={values.poultryTypeId}
          onChange={(e) => onChange({ poultryTypeId: e.target.value })}
          className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">— Select —</option>
          {poultryTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-ink-soft">Batch code</label>
        <input
          required
          value={values.batchCode}
          onChange={(e) => onChange({ batchCode: e.target.value })}
          className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-ink-soft">Breed</label>
          <input
            value={values.breed}
            onChange={(e) => onChange({ breed: e.target.value })}
            placeholder="e.g. Kenbro, Isa Brown"
            className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink-soft">Company (hatchery)</label>
          <input
            value={values.supplier}
            onChange={(e) => onChange({ supplier: e.target.value })}
            placeholder="e.g. Kenchic"
            className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-ink-soft">Source of birds</label>
        <input
          value={values.source}
          onChange={(e) => onChange({ source: e.target.value })}
          placeholder="Where you actually picked them up — agrovet, agent, hatchery depot…"
          className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink-soft">Placement date</label>
        <input
          type="date"
          required
          value={values.placementDate}
          onChange={(e) => onChange({ placementDate: e.target.value })}
          className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink-soft">How many birds?</label>
        <input
          type="number"
          required
          min={1}
          value={values.initialQuantity}
          onChange={(e) => onChange({ initialQuantity: e.target.value })}
          placeholder="e.g. 250"
          className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
    </>
  );
}
