"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingState } from "@/lib/data/onboarding";
import type { PoultryType } from "@/lib/database.types";
import { FlockFormFields, type FlockFormValues } from "@/components/app/flock-form-fields";

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

type Step = "farm" | "house" | "flock";

export function OnboardingWizard({ initial }: { initial: OnboardingState }) {
  const router = useRouter();

  const [tenantId, setTenantId] = useState(initial.tenant?.id ?? null);
  const [farmerId, setFarmerId] = useState(initial.farmer?.id ?? null);
  const [farmId, setFarmId] = useState(initial.farm?.id ?? null);
  const [step, setStep] = useState<Step>(initial.farm ? (initial.house ? "flock" : "house") : "farm");

  const [yourName, setYourName] = useState(initial.farmer?.full_name ?? "");
  const [farmName, setFarmName] = useState(initial.farm?.name ?? "");
  const [county, setCounty] = useState(initial.farm?.county ?? "");

  const [houseName, setHouseName] = useState("House 1");
  const [capacity, setCapacity] = useState("");

  const [poultryTypes, setPoultryTypes] = useState<PoultryType[]>([]);
  const [flock, setFlock] = useState<FlockFormValues>({
    poultryTypeId: "",
    batchCode: "BATCH-1",
    placementDate: new Date().toISOString().slice(0, 10),
    initialQuantity: "",
    breed: "",
    supplier: "",
    source: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== "flock" || !tenantId) return;
    const supabase = createClient();
    supabase
      .from("poultryedos_poultry_types")
      .select("*")
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const types = (data ?? []) as PoultryType[];
        setPoultryTypes(types);
        if (types.length > 0) {
          setFlock((prev) => (prev.poultryTypeId ? prev : { ...prev, poultryTypeId: types[0].id }));
        }
      });
  }, [step, tenantId]);

  async function handleFarmSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    let currentTenantId = tenantId;
    if (!currentTenantId) {
      const { data, error } = await supabase.rpc("poultryedos_create_tenant", {
        p_name: farmName,
        p_slug: `${slugify(farmName)}-${randomSuffix()}`,
      });
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      currentTenantId = data as string;
      setTenantId(currentTenantId);
    }

    let currentFarmerId = farmerId;
    if (!currentFarmerId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("poultryedos_farmers")
        .insert({
          tenant_id: currentTenantId,
          user_id: user?.id ?? null,
          full_name: yourName,
          county: county || null,
        })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        setError(error?.message ?? "Could not create farmer profile");
        return;
      }
      currentFarmerId = (data as { id: string }).id;
      setFarmerId(currentFarmerId);
    }

    if (!farmId) {
      const { data, error } = await supabase
        .from("poultryedos_farms")
        .insert({ tenant_id: currentTenantId, farmer_id: currentFarmerId, name: farmName, county: county || null })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        setError(error?.message ?? "Could not create farm");
        return;
      }
      setFarmId((data as { id: string }).id);
    }

    setBusy(false);
    setStep("house");
  }

  async function handleHouseSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.from("poultryedos_houses").insert({
      tenant_id: tenantId,
      farm_id: farmId,
      name: houseName,
      capacity: capacity ? Number(capacity) : null,
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("flock");
  }

  async function handleFlockSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { data: house } = await supabase
      .from("poultryedos_houses")
      .select("id")
      .eq("farm_id", farmId)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const qty = Number(flock.initialQuantity);
    const { error } = await supabase.from("poultryedos_flocks").insert({
      tenant_id: tenantId,
      farm_id: farmId,
      house_id: house?.id ?? null,
      poultry_type_id: flock.poultryTypeId || null,
      batch_code: flock.batchCode,
      placement_date: flock.placementDate,
      initial_quantity: qty,
      current_quantity: qty,
      breed: flock.breed || null,
      supplier: flock.supplier || null,
      source: flock.source || null,
    });

    setBusy(false);
    if (error) {
      setError(
        error.message.includes("duplicate")
          ? "That batch code is already used — try another."
          : error.message,
      );
      return;
    }
    router.push("/app/home");
    router.refresh();
  }

  return (
    <div>
      <p className="text-sm font-medium uppercase tracking-wide text-accent-dark">
        Set up your farm
      </p>
      <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-ink">
        {step === "farm" && "Tell us about your farm"}
        {step === "house" && "Add a house"}
        {step === "flock" && "Add your first flock"}
      </h1>

      <ol className="mt-4 flex gap-2 text-xs font-medium text-ink-faint">
        {(["farm", "house", "flock"] as Step[]).map((s, i) => (
          <li
            key={s}
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              step === s ? "bg-primary text-white" : "bg-line"
            }`}
          >
            {i + 1}
          </li>
        ))}
      </ol>

      {step === "farm" && (
        <form onSubmit={handleFarmSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-ink-soft">Your name</label>
            <input
              required
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-soft">Farm name</label>
            <input
              required
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="e.g. Wanjiru Poultry Farm"
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-soft">County (optional)</label>
            <input
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      )}

      {step === "house" && (
        <form onSubmit={handleHouseSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-ink-soft">House name</label>
            <input
              required
              value={houseName}
              onChange={(e) => setHouseName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink-soft">Capacity (optional)</label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="e.g. 300"
              className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </form>
      )}

      {step === "flock" && (
        <form onSubmit={handleFlockSubmit} className="mt-6 space-y-4">
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
            {busy ? "Saving…" : "Finish setup"}
          </button>
        </form>
      )}
    </div>
  );
}
