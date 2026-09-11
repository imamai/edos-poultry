"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n/translations";

/** Tenant-wide language preference (spec §10) — not per-user. For the
 * individual-smallholder tenant this feature is primarily aimed at, the
 * farmer already is the tenant's owner, so this is effectively "my
 * language." A farmer-role member of a multi-farmer tenant can't change it
 * (poultryedos_tenants' update policy is owner/admin-only) — a deliberate,
 * simple scope line rather than building per-user locale preferences. */
export function LanguageToggle({ tenantId, locale }: { tenantId: string; locale: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const current: Locale = locale === "sw" ? "sw" : "en";

  async function setLocale(next: Locale) {
    if (next === current || busy) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("poultryedos_tenants").update({ locale: next }).eq("id", tenantId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="inline-flex rounded-full border border-line-strong bg-paper-raised p-0.5 text-xs">
      <button
        type="button"
        disabled={busy}
        onClick={() => setLocale("en")}
        className={`rounded-full px-2.5 py-1 ${current === "en" ? "bg-primary text-white" : "text-ink-faint"}`}
      >
        EN
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setLocale("sw")}
        className={`rounded-full px-2.5 py-1 ${current === "sw" ? "bg-primary text-white" : "text-ink-faint"}`}
      >
        SW
      </button>
    </div>
  );
}
