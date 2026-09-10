import { redirect } from "next/navigation";
import Link from "next/link";
import { getMyMembership } from "@/lib/data/farmer";
import { getAssignedFarmers } from "@/lib/data/network";

export default async function FieldFarmersPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const farmers = await getAssignedFarmers(membership.userId);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Your farmers</h1>
      <p className="mt-1 text-sm text-ink-soft">{farmers.length} assigned to you</p>

      <div className="mt-4 space-y-2">
        {farmers.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No farmers assigned to you yet.
          </p>
        )}
        {farmers.map((f) => (
          <div key={f.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3">
            <p className="font-medium text-ink">{f.full_name}</p>
            <p className="text-xs text-ink-faint">
              {f.farm_count} farm{f.farm_count === 1 ? "" : "s"}
              {f.phone && ` · ${f.phone}`}
              {(f.county || f.ward) && ` · ${[f.county, f.ward].filter(Boolean).join(", ")}`}
            </p>
          </div>
        ))}
      </div>

      <Link
        href="/app/field/visits"
        className="mt-6 block rounded-full bg-primary px-6 py-3 text-center text-sm font-medium text-white hover:bg-primary-dark"
      >
        View your visits
      </Link>
    </div>
  );
}
