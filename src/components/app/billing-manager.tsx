"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/money";
import type { DerivedSubscriptionStatus, PlanUsage } from "@/lib/data/subscriptions";
import type { MpesaTransaction, Subscription, SubscriptionPlan } from "@/lib/database.types";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  trial: { label: "Trial", className: "bg-accent-soft text-accent-dark" },
  active: { label: "Active", className: "bg-success-soft text-success" },
  past_due: { label: "Payment due", className: "bg-warning-soft text-warning" },
  grace_period: { label: "Grace period", className: "bg-warning-soft text-warning" },
  suspended: { label: "Suspended", className: "bg-danger-soft text-danger" },
  expired: { label: "Expired", className: "bg-danger-soft text-danger" },
  cancelled: { label: "Cancelled", className: "bg-line text-ink-faint" },
};

const LIMIT_LABELS: Record<string, string> = {
  farmers: "Farmers",
  farms: "Farms",
  houses: "Houses",
  flocks: "Flocks",
  users: "Team members",
  field_officers: "Field officers",
};

export function BillingManager({
  currency,
  plans,
  subscription,
  derivedStatus,
  usage,
  mpesaConfigured,
  transactions,
}: {
  currency: string;
  plans: SubscriptionPlan[];
  subscription: (Subscription & { poultryedos_subscription_plans: SubscriptionPlan }) | null;
  derivedStatus: DerivedSubscriptionStatus | null;
  usage: PlanUsage | null;
  mpesaConfigured: boolean;
  transactions: MpesaTransaction[];
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchPlan(planId: string) {
    if (!subscription) return;
    setSwitching(planId);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("poultryedos_subscriptions")
      .update({ plan_id: planId })
      .eq("id", subscription.id);
    setSwitching(null);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  if (!subscription) {
    return (
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Billing</h1>
        <p className="mt-4 rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
          No subscription found for this account yet.
        </p>
      </div>
    );
  }

  const statusMeta = STATUS_LABELS[derivedStatus?.status ?? "trial"];

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Billing</h1>

      <div className="mt-4 rounded-2xl border border-line bg-paper-raised p-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl font-medium text-ink">{subscription.poultryedos_subscription_plans.name}</p>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>{statusMeta.label}</span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {formatMoney(subscription.poultryedos_subscription_plans.price_cents, currency)} /{" "}
          {subscription.poultryedos_subscription_plans.billing_interval}
        </p>
        {derivedStatus?.status === "trial" && derivedStatus.daysRemaining != null && (
          <p className="mt-2 text-xs text-ink-faint">{Math.max(derivedStatus.daysRemaining, 0)} day(s) left in your trial.</p>
        )}
        {(derivedStatus?.status === "past_due" || derivedStatus?.status === "grace_period") && (
          <p className="mt-2 text-xs text-warning">Your last payment didn&apos;t go through — pay below to stay current.</p>
        )}
        {derivedStatus?.status === "suspended" && (
          <p className="mt-2 text-xs text-danger">Access is limited until you renew. Your data is safe and hasn&apos;t been deleted.</p>
        )}
      </div>

      {usage && Object.keys(usage.limits).length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium text-ink-soft">Usage</p>
          <div className="mt-3 space-y-3">
            {Object.entries(usage.limits).map(([key, limit]) => {
              if (limit == null) return null;
              const used = usage.usage[key as keyof typeof usage.usage] ?? 0;
              const pct = Math.min(100, Math.round((used / limit) * 100));
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs text-ink-faint">
                    <span>{LIMIT_LABELS[key] ?? key}</span>
                    <span>
                      {used} / {limit}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-line">
                    <div
                      className={`h-1.5 rounded-full ${pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <MpesaPaySection mpesaConfigured={mpesaConfigured} amountCents={subscription.poultryedos_subscription_plans.price_cents} currency={currency} />

      <h2 className="mt-6 text-sm font-medium text-ink-soft">Plans</h2>
      <div className="mt-2 space-y-2">
        {plans.map((plan) => {
          const isCurrent = plan.id === subscription.plan_id;
          return (
            <div
              key={plan.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                isCurrent ? "border-primary bg-primary-soft" : "border-line bg-paper-raised"
              }`}
            >
              <div>
                <p className="font-medium text-ink">{plan.name}</p>
                <p className="text-xs text-ink-faint">
                  {formatMoney(plan.price_cents, currency)} / {plan.billing_interval}
                </p>
              </div>
              {isCurrent ? (
                <span className="text-xs font-medium text-primary">Current plan</span>
              ) : (
                <button
                  type="button"
                  disabled={switching === plan.id}
                  onClick={() => switchPlan(plan.id)}
                  className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:border-primary disabled:opacity-60"
                >
                  {switching === plan.id ? "Switching…" : "Switch"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {transactions.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-medium text-ink-soft">Payment history</h2>
          <div className="mt-2 space-y-1.5">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm">
                <span className="text-ink-soft">{formatMoney(t.amount_cents, currency)} · {t.phone}</span>
                <span className="text-xs capitalize text-ink-faint">{t.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MpesaPaySection({
  mpesaConfigured,
  amountCents,
  currency,
}: {
  mpesaConfigured: boolean;
  amountCents: number;
  currency: string;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/mpesa/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        setMessage(data.message ?? "Could not start the M-Pesa payment.");
        return;
      }
      setMessage("Check your phone to complete the M-Pesa payment.");
    } catch {
      setMessage("Could not reach the payment service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper-raised p-4">
      <p className="text-sm font-medium text-ink-soft">Pay with M-Pesa</p>
      <p className="mt-1 text-xs text-ink-faint">{formatMoney(amountCents, currency)} will be requested via STK push.</p>
      {!mpesaConfigured ? (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          M-Pesa isn&apos;t configured for this environment yet.{" "}
          <Link href="/app/help" className="underline">
            Contact support
          </Link>{" "}
          to arrange payment another way.
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="2547XXXXXXXX"
            className="flex-1 rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={busy || !phone}
            onClick={pay}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Sending…" : "Pay"}
          </button>
        </div>
      )}
      {message && <p className="mt-2 text-xs text-ink-soft">{message}</p>}
    </div>
  );
}
