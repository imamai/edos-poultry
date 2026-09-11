import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/data/farmer";
import { getNetworkSummary } from "@/lib/data/network";
import { formatMoney } from "@/lib/money";

export default async function NetworkPage() {
  const membership = await getMyMembership();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "owner" && membership.role !== "admin") {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        Only owners and admins see the network view.
      </div>
    );
  }

  const summary = await getNetworkSummary(membership.tenant.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Network</h1>
      <p className="mt-1 text-sm text-ink-soft">{membership.tenant.name} · last 7 days</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Farmers" value={String(summary.farmerCount)} />
        <Stat label="Farms" value={String(summary.farmCount)} />
        <Stat label="Active flocks" value={String(summary.flockCount)} />
        <Stat label="Total birds" value={String(summary.totalBirds)} />
        <Stat label="Mortality (7d)" value={String(summary.mortality7d)} />
        <Stat label="Eggs (7d)" value={String(summary.eggs7d)} />
        <Stat label="Sales (7d)" value={formatMoney(summary.sales7dCents, membership.tenant.currency)} />
        <Stat label="Expenses (7d)" value={formatMoney(summary.expenses7dCents, membership.tenant.currency)} />
      </div>

      {summary.farmerCount === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
          No farmers yet — add your first one from Team.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper-raised p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium text-ink">{value}</p>
    </div>
  );
}
