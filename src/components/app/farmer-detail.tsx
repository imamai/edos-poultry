import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { FarmerDetail } from "@/lib/data/network";
import { formatMoney } from "@/lib/money";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success-soft text-success",
  sold_out: "bg-line text-ink-faint",
  closed: "bg-line text-ink-faint",
};

export function FarmerDetailView({ detail, currency }: { detail: FarmerDetail; currency: string }) {
  const { farmer, farms, summary } = detail;

  return (
    <div>
      <Link href="/app/team" className="text-xs text-ink-faint hover:text-ink-soft">
        ← Back to Team
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-ink">{farmer.full_name}</h1>
          <p className="mt-1 text-sm text-ink-faint">
            {[farmer.phone, farmer.county, farmer.sub_county].filter(Boolean).join(" · ") || "No contact details on file"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${farmer.user_id ? "bg-success-soft text-success" : "bg-line text-ink-faint"}`}>
          {farmer.user_id ? "Has own login" : "Managed directly"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Farms" value={String(farms.length)} />
        <Stat label="Active flocks" value={String(summary.activeFlockCount)} />
        <Stat label="Total birds" value={String(summary.totalBirds)} />
        <Stat label="Mortality (7d)" value={String(summary.mortality7d)} />
        <Stat label="Eggs (7d)" value={String(summary.eggs7d)} />
        <Stat label="Sales (7d)" value={formatMoney(summary.sales7dCents, currency)} />
        <Stat label="Expenses (7d)" value={formatMoney(summary.expenses7dCents, currency)} />
      </div>

      <h2 className="mt-6 text-sm font-medium text-ink-soft">Farms</h2>
      <div className="mt-2 space-y-3">
        {farms.length === 0 && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No farms set up yet.
          </p>
        )}
        {farms.map((farm) => (
          <div key={farm.id} className="rounded-xl border border-line bg-paper-raised p-4">
            <p className="font-medium text-ink">{farm.name}</p>
            <p className="text-xs text-ink-faint">
              {[farm.county, farm.sub_county, farm.ward].filter(Boolean).join(", ") || "No location on file"}
            </p>

            {farm.flocks.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">No flocks yet.</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {farm.flocks.map((flock) => (
                  <Link
                    key={flock.id}
                    href={`/app/flock/${flock.id}`}
                    className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm hover:border-primary"
                  >
                    <div>
                      <span className="font-medium text-ink">{flock.batch_code}</span>
                      <span className="ml-2 text-ink-faint">{flock.current_quantity} birds</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[flock.status] ?? "bg-line text-ink-faint"}`}>
                        {flock.status.replace("_", " ")}
                      </span>
                      <ChevronRight className="h-4 w-4 text-ink-faint" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper-raised p-3">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-xl font-medium text-ink">{value}</p>
    </div>
  );
}
