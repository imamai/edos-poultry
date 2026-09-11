import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMyMembership } from "@/lib/data/farmer";
import { getTenantSubscription } from "@/lib/data/subscriptions";
import { initiateStkPush } from "@/lib/payments/mpesa";

/**
 * Authenticated owner/admin initiates an M-Pesa STK push to pay for their
 * current plan. Runs as the signed-in user, so the insert below goes
 * through the normal poultryedos_mpesa_transactions RLS policy (see
 * migration 0019) — only the callback route (service-role, no session) is
 * allowed to mark a transaction success/failed.
 */
export async function POST(request: Request) {
  const membership = await getMyMembership();
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { phone?: string } | null;
  const phone = body?.phone?.trim();
  if (!phone || !/^2547\d{8}$/.test(phone)) {
    return NextResponse.json({ error: "invalid_phone", message: "Use format 2547XXXXXXXX" }, { status: 400 });
  }

  const subscription = await getTenantSubscription(membership.tenant.id);
  if (!subscription) {
    return NextResponse.json({ error: "no_subscription" }, { status: 400 });
  }
  const plan = subscription.poultryedos_subscription_plans;

  const result = await initiateStkPush({
    phone,
    amountCents: plan.price_cents,
    accountReference: membership.tenant.slug,
    description: `EDOS Poultry360 — ${plan.name} plan`,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.reason,
        message:
          result.reason === "not_configured"
            ? "M-Pesa isn't configured for this environment yet."
            : result.message,
      },
      { status: result.reason === "not_configured" ? 501 : 502 },
    );
  }

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("poultryedos_mpesa_transactions").insert({
    tenant_id: membership.tenant.id,
    subscription_id: subscription.id,
    phone,
    amount_cents: plan.price_cents,
    status: "pending",
    checkout_request_id: result.checkoutRequestId,
    merchant_request_id: result.merchantRequestId,
    initiated_by: membership.userId,
  });
  if (insertError) {
    return NextResponse.json({ error: "log_failed", message: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checkoutRequestId: result.checkoutRequestId });
}
