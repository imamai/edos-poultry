import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { createClient } from "@/lib/supabase/server";
import { getAllFlocks } from "@/lib/data/farmer";

export default async function FlockListPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();
  const { data: farm } = await supabase
    .from("poultryedos_farms")
    .select("id")
    .eq("tenant_id", membership.tenant.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!farm) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        No farm yet.
      </div>
    );
  }

  const flocks = await getAllFlocks(farm.id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Flocks</h1>
        <Link
          href="/app/flock/new"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
        >
          + Add flock
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        {flocks.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No flocks yet.
          </p>
        )}
        {flocks.map((f) => (
          <Link
            key={f.id}
            href={`/app/flock/${f.id}`}
            className="block rounded-xl border border-line bg-paper-raised px-4 py-3 hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">{f.batch_code}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                  f.status === "active" ? "bg-success-soft text-success" : "bg-line text-ink-faint"
                }`}
              >
                {f.status.replace("_", " ")}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {f.current_quantity} birds
              {f.breed && ` · ${f.breed}`}
              {" · placed "}
              {new Date(f.placement_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
