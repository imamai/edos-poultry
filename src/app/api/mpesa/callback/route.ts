import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCallback, type MpesaCallbackPayload } from "@/lib/payments/mpesa";

/**
 * Public webhook Safaricom calls with no Supabase session at all — this is
 * the one place in the app allowed to transition an M-Pesa transaction to
 * success/failed, which is why it uses the service-role admin client
 * (bypasses RLS) instead of the normal request-scoped one. The only trust
 * boundary is matching CheckoutRequestID against a transaction this app
 * itself initiated as "pending" — an unrecognized ID is ignored.
 *
 * Untested against a live Safaricom sandbox in this environment (no
 * credentials here — see src/lib/payments/mpesa.ts and README).
 */
export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as MpesaCallbackPayload | null;
  if (!payload?.Body?.stkCallback) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid payload" }, { status: 400 });
  }

  const result = parseCallback(payload);
  const supabase = createAdminClient();

  const { data: transaction } = await supabase
    .from("poultryedos_mpesa_transactions")
    .select("id, subscription_id")
    .eq("checkout_request_id", result.checkoutRequestId)
    .maybeSingle();

  if (!transaction) {
    // Unrecognized checkout request — acknowledge so Safaricom stops
    // retrying, but there is nothing of ours to update.
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  await supabase
    .from("poultryedos_mpesa_transactions")
    .update({
      status: result.success ? "success" : "failed",
      result_desc: result.resultDesc,
      mpesa_receipt_number: result.mpesaReceiptNumber,
    })
    .eq("id", transaction.id);

  if (result.success && transaction.subscription_id) {
    const { data: subscription } = await supabase
      .from("poultryedos_subscriptions")
      .select("id, current_period_end, poultryedos_subscription_plans(billing_interval)")
      .eq("id", transaction.subscription_id)
      .maybeSingle();

    if (subscription) {
      const interval =
        (subscription as unknown as { poultryedos_subscription_plans: { billing_interval: string } })
          .poultryedos_subscription_plans?.billing_interval ?? "monthly";
      const base = subscription.current_period_end ? new Date(subscription.current_period_end) : new Date();
      const start = base.getTime() > Date.now() ? base : new Date();
      const nextPeriodEnd = new Date(start);
      if (interval === "annual") nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      else nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

      await supabase
        .from("poultryedos_subscriptions")
        .update({
          status: "active",
          current_period_start: start.toISOString(),
          current_period_end: nextPeriodEnd.toISOString(),
        })
        .eq("id", subscription.id);
    }
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
