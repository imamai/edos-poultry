"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SuperAdminTenantRow } from "@/lib/data/super-admin";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success-soft text-success",
  onboarding: "bg-accent-soft text-accent-dark",
  suspended: "bg-danger-soft text-danger",
  cancelled: "bg-line text-ink-faint",
};

export function SuperAdminDashboard({ tenants }: { tenants: SuperAdminTenantRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleSuspend(tenant: SuperAdminTenantRow) {
    const suspending = tenant.status !== "suspended";
    const verb = suspending ? "suspend" : "reactivate";
    if (!window.confirm(`${suspending ? "Suspend" : "Reactivate"} "${tenant.name}"? ${suspending ? "They will lose write access immediately — their data stays intact." : "They will regain full access immediately."}`)) {
      return;
    }

    setBusyId(tenant.tenant_id);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("poultryedos_super_admin_set_tenant_status", {
      p_tenant_id: tenant.tenant_id,
      p_suspend: suspending,
    });
    setBusyId(null);
    if (error) {
      setError(`Could not ${verb} ${tenant.name}: ${error.message}`);
      return;
    }
    router.refresh();
  }

  const totals = {
    tenants: tenants.length,
    farmers: tenants.reduce((sum, t) => sum + t.farmer_count, 0),
    farms: tenants.reduce((sum, t) => sum + t.farm_count, 0),
    flocks: tenants.reduce((sum, t) => sum + t.flock_count, 0),
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Super Admin</h1>
      <p className="mt-1 text-sm text-ink-soft">Every tenant on EDOS Poultry360.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tenants" value={String(totals.tenants)} />
        <Stat label="Farmers" value={String(totals.farmers)} />
        <Stat label="Farms" value={String(totals.farms)} />
        <Stat label="Flocks" value={String(totals.flocks)} />
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-paper-raised text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Tenant</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Billing status</th>
              <th className="px-4 py-2.5 text-right font-medium">Farmers</th>
              <th className="px-4 py-2.5 text-right font-medium">Farms</th>
              <th className="px-4 py-2.5 text-right font-medium">Flocks</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.tenant_id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{t.name}</p>
                  <p className="text-xs text-ink-faint">{t.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[t.status] ?? "bg-line text-ink-faint"}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-soft">{t.plan_name ?? t.plan}</td>
                <td className="px-4 py-3 text-ink-soft capitalize">{t.subscription_status ?? "—"}</td>
                <td className="px-4 py-3 text-right text-ink-soft">{t.farmer_count}</td>
                <td className="px-4 py-3 text-right text-ink-soft">{t.farm_count}</td>
                <td className="px-4 py-3 text-right text-ink-soft">{t.flock_count}</td>
                <td className="px-4 py-3 text-ink-faint">
                  {new Date(t.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={busyId === t.tenant_id}
                    onClick={() => toggleSuspend(t)}
                    className={`rounded-full border px-3 py-1.5 text-xs disabled:opacity-60 ${
                      t.status === "suspended"
                        ? "border-success text-success hover:bg-success-soft"
                        : "border-danger text-danger hover:bg-danger-soft"
                    }`}
                  >
                    {busyId === t.tenant_id ? "Working…" : t.status === "suspended" ? "Reactivate" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <p className="p-8 text-center text-sm text-ink-faint">No tenants yet.</p>
        )}
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
