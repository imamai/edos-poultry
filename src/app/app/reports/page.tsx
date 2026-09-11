import { getMyMembership } from "@/lib/data/farmer";
import {
  lastNDaysRange,
  customRange,
  getAllTenantFlocks,
  getProductionReport,
  getMortalityReport,
  getFinancialReport,
} from "@/lib/data/reports";
import { getNotifications } from "@/lib/data/notifications";
import { ReportsHub } from "@/components/app/reports-hub";

const ALLOWED_ROLES = ["owner", "admin", "farm_manager"];
const SUGGESTABLE_TYPES = ["production_decline", "mortality_alert"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; flock?: string; from?: string; to?: string }>;
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

  const { range: rangeParam, flock: flockParam, from, to } = await searchParams;
  const days = rangeParam === "7" ? 7 : rangeParam === "90" ? 90 : 30;
  const range = from && to ? customRange(from, to) : lastNDaysRange(days);
  const flockId = flockParam || undefined;

  const [flocks, production, mortality, financial, notifications] = await Promise.all([
    getAllTenantFlocks(membership.tenant.id),
    getProductionReport(membership.tenant.id, range, flockId),
    getMortalityReport(membership.tenant.id, range, flockId),
    getFinancialReport(membership.tenant.id, range, flockId),
    getNotifications(membership.userId, 20),
  ]);

  // "Worth checking" reuses the same notification feed already shown by
  // the bell icon (ensureDueNotifications), rather than a second signal-
  // detection system. dedupe_key for these two types is
  // "type:flockId:extra" (see src/lib/data/notifications.ts) -- parsed
  // here to pre-select that batch in the suggested link.
  const suggestion = notifications.find((n) => !n.read_at && SUGGESTABLE_TYPES.includes(n.type));
  const suggestionFlockId = suggestion?.dedupe_key?.split(":")[1];

  return (
    <ReportsHub
      tenantName={membership.tenant.name}
      currency={membership.tenant.currency}
      selectedDays={days}
      customFrom={from}
      customTo={to}
      range={range}
      flocks={flocks}
      selectedFlockId={flockId ?? null}
      production={production}
      mortality={mortality}
      financial={financial}
      suggestion={suggestion ? { body: suggestion.body, flockId: suggestionFlockId ?? null } : null}
    />
  );
}
