"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PoultryType } from "@/lib/database.types";
import { FlockFormFields, type FlockFormValues } from "@/components/app/flock-form-fields";

export function NewFlockForm({
  tenantId,
  farmId,
  houseId,
  poultryTypes,
}: {
  tenantId: string;
  farmId: string;
  houseId: string | null;
  poultryTypes: PoultryType[];
}) {
  const router = useRouter();
  const [flock, setFlock] = useState<FlockFormValues>({
    poultryTypeId: poultryTypes[0]?.id ?? "",
    batchCode: "",
    placementDate: new Date().toISOString().slice(0, 10),
    initialQuantity: "",
    breed: "",
    supplier: "",
    source: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const qty = Number(flock.initialQuantity);
    const { data, error } = await supabase
      .from("poultryedos_flocks")
      .insert({
        tenant_id: tenantId,
        farm_id: farmId,
        house_id: houseId,
        poultry_type_id: flock.poultryTypeId || null,
        batch_code: flock.batchCode,
        placement_date: flock.placementDate,
        initial_quantity: qty,
        current_quantity: qty,
        breed: flock.breed || null,
        supplier: flock.supplier || null,
        source: flock.source || null,
      })
      .select("id")
      .single();

    setBusy(false);
    if (error || !data) {
      setError(
        error?.message.includes("duplicate") ? "That batch code is already used — try another." : error?.message ?? "Could not create flock",
      );
      return;
    }
    router.push(`/app/flock/${(data as { id: string }).id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <FlockFormFields
        values={flock}
        onChange={(patch) => setFlock((prev) => ({ ...prev, ...patch }))}
        poultryTypes={poultryTypes}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? "Saving…" : "Add flock"}
      </button>
    </form>
  );
}
