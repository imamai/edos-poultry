import { getMyMembership } from "@/lib/data/farmer";
import { getSubscriptionPlans, getTenantSubscription, deriveSubscriptionStatus, getPlanUsage } from "@/lib/data/subscriptions";
import { isMpesaConfigured } from "@/lib/payments/mpesa";
import { createClient } from "@/lib/supabase/server";
import { BillingManager } from "@/components/app/billing-manager";
import type { MpesaTransaction } from "@/lib/database.types";

export default async function BillingPage() {
  const membership = await getMyMembership();
  if (!membership) return null;
  if (membership.role !== "owner" && membership.role !== "admin") {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        Only owners and admins manage billing.
      </div>
    );
  }

  const [plans, subscription] = await Promise.all([
    getSubscriptionPlans(),
    getTenantSubscription(membership.tenant.id),
  ]);

  const derived = subscription ? deriveSubscriptionStatus(subscription) : null;
  const usage = subscription ? await getPlanUsage(membership.tenant.id, subscription.poultryedos_subscription_plans.limits) : null;

  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from("poultryedos_mpesa_transactions")
    .select("*")
    .eq("tenant_id", membership.tenant.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <BillingManager
      currency={membership.tenant.currency}
      plans={plans}
      subscription={subscription}
      derivedStatus={derived}
      usage={usage}
      mpesaConfigured={isMpesaConfigured()}
      transactions={(transactions ?? []) as MpesaTransaction[]}
    />
  );
}
