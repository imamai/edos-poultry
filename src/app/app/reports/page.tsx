import { getMyMembership } from "@/lib/data/farmer";
import { lastNDaysRange, getProductionReport, getMortalityReport, getFinancialReport } from "@/lib/data/reports";
import { ReportsHub } from "@/components/app/reports-hub";

const ALLOWED_ROLES = ["owner", "admin", "farm_manager"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const membership = await getMyMembership();
  if (!membership) return null;
  if (!ALLOWED_ROLES.includes(membership.role)) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        Reports are available to owners, admins, and farm managers.
      </div>
    );
  }

  const { range: rangeParam } = await searchParams;
  const days = rangeParam === "7" ? 7 : rangeParam === "90" ? 90 : 30;
  const range = lastNDaysRange(days);

  const [production, mortality, financial] = await Promise.all([
    getProductionReport(membership.tenant.id, range),
    getMortalityReport(membership.tenant.id, range),
    getFinancialReport(membership.tenant.id, range),
  ]);

  return (
    <ReportsHub
      tenantName={membership.tenant.name}
      currency={membership.tenant.currency}
      selectedDays={days}
      range={range}
      production={production}
      mortality={mortality}
      financial={financial}
    />
  );
}
