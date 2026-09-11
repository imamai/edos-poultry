"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type { Farmer, FieldVisit, FieldVisitStatus } from "@/lib/database.types";

// Leaflet touches `window` at module load, so it can never run during SSR
// — dynamic-import it client-only rather than importing MapView directly.
const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), { ssr: false });

const SEQUENCE: FieldVisitStatus[] = [
  "assigned",
  "traveling",
  "visited",
  "assessment",
  "recommendation",
  "action_required",
  "follow_up",
  "resolved",
];

const LABELS: Record<FieldVisitStatus, string> = {
  assigned: "Assigned",
  traveling: "Traveling",
  visited: "Visited",
  assessment: "Assessment",
  recommendation: "Recommendation",
  action_required: "Action required",
  follow_up: "Follow-up",
  resolved: "Resolved",
};

export function VisitManager({
  tenantId,
  fieldOfficerUserId,
  visits,
  farmers,
}: {
  tenantId: string;
  fieldOfficerUserId: string;
  visits: (FieldVisit & { poultryedos_farmers: { full_name: string } | null })[];
  farmers: (Farmer & { farm_count: number })[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [farmerId, setFarmerId] = useState(farmers[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only visits that actually captured GPS (spec §61) — a visit marked
  // "visited" or later, best-effort (geolocation can fail or be denied).
  const mapPoints = useMemo(
    () =>
      visits
        .filter((v): v is typeof v & { gps_lat: number; gps_lng: number } => v.gps_lat != null && v.gps_lng != null)
        .map((v) => ({
          lat: v.gps_lat,
          lng: v.gps_lng,
          label: `${v.poultryedos_farmers?.full_name ?? "Farmer"} — ${LABELS[v.status]}`,
        })),
    [visits],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_field_visits").insert({
      tenant_id: tenantId,
      field_officer_user_id: fieldOfficerUserId,
      farmer_id: farmerId,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAdding(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Your visits</h1>
        {!adding && farmers.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
          >
            + New visit
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-xl border border-line bg-paper-raised p-4">
          <select
            value={farmerId}
            onChange={(e) => setFarmerId(e.target.value)}
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.full_name}
              </option>
            ))}
          </select>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {mapPoints.length > 0 && (
        <div className="mt-4">
          <MapView points={mapPoints} height={240} />
        </div>
      )}

      <div className="mt-4 space-y-3">
        {visits.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No visits yet.
          </p>
        )}
        {visits.map((v) => (
          <VisitCard key={v.id} visit={v} />
        ))}
      </div>
    </div>
  );
}

function VisitCard({
  visit,
}: {
  visit: FieldVisit & { poultryedos_farmers: { full_name: string } | null };
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const currentIndex = SEQUENCE.indexOf(visit.status);
  const nextStatus = SEQUENCE[currentIndex + 1];
  const needsNote = nextStatus === "assessment" || nextStatus === "recommendation";

  async function advance() {
    setBusy(true);
    const supabase = createClient();
    const update: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "visited") {
      update.visited_at = new Date().toISOString();
      if (navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              update.gps_lat = pos.coords.latitude;
              update.gps_lng = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 3000 },
          );
        });
      }
    }
    if (nextStatus === "assessment") update.assessment = note;
    if (nextStatus === "recommendation") update.recommendation = note;

    await supabase.from("poultryedos_field_visits").update(update).eq("id", visit.id);
    setBusy(false);
    setNote("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-line bg-paper-raised px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-ink">{visit.poultryedos_farmers?.full_name ?? "Farmer"}</p>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{LABELS[visit.status]}</span>
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        {new Date(visit.scheduled_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
      </p>
      {visit.assessment && <p className="mt-2 text-sm text-ink-soft">Assessment: {visit.assessment}</p>}
      {visit.recommendation && <p className="mt-1 text-sm text-ink-soft">Recommendation: {visit.recommendation}</p>}

      {nextStatus && (
        <div className="mt-3">
          {needsNote && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={nextStatus === "assessment" ? "What did you find?" : "What do you recommend?"}
              rows={2}
              className="mb-2 w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
            />
          )}
          <button
            type="button"
            disabled={busy || (needsNote && !note.trim())}
            onClick={advance}
            className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary disabled:opacity-50"
          >
            {busy ? "Saving…" : `Mark as ${LABELS[nextStatus]}`}
          </button>
        </div>
      )}
    </div>
  );
}
