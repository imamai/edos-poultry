"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Farmer, FarmerInvite } from "@/lib/database.types";
import type { TenantMemberWithEmail } from "@/lib/data/network";

export function TeamManager({
  tenantId,
  farmers,
  invites,
  members,
}: {
  tenantId: string;
  farmers: (Farmer & { farm_count: number })[];
  invites: FarmerInvite[];
  members: TenantMemberWithEmail[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleAddFarmer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("poultryedos_farmers").insert({
      tenant_id: tenantId,
      full_name: name,
      phone: phone || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setPhone("");
    setAdding(false);
    router.refresh();
  }

  async function copyLink(farmerId: string, token: string) {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(farmerId);
    setTimeout(() => setCopiedId(null), 3000);
  }

  async function inviteFarmer(farmerId: string, email: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("poultryedos_farmer_invites")
      .insert({ tenant_id: tenantId, farmer_id: farmerId, email })
      .select("token")
      .single();
    if (error || !data) return;
    await copyLink(farmerId, (data as { token: string }).token);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Team</h1>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
          >
            + Add farmer
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Add farmers you manage directly — they don&apos;t need their own login unless you invite them.
      </p>

      {adding && (
        <form onSubmit={handleAddFarmer} className="mt-4 space-y-3 rounded-xl border border-line bg-paper-raised p-4">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Farmer's full name"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdding(false)} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      <h2 className="mt-6 text-sm font-medium text-ink-soft">Farmers ({farmers.length})</h2>
      <div className="mt-2 space-y-2">
        {farmers.map((f) => {
          const pendingInvite = invites.find((i) => i.farmer_id === f.id);
          return (
            <div key={f.id} className="rounded-xl border border-line bg-paper-raised px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{f.full_name}</p>
                  <p className="text-xs text-ink-faint">
                    {f.farm_count} farm{f.farm_count === 1 ? "" : "s"}
                    {f.phone && ` · ${f.phone}`}
                    {f.user_id ? " · has own login" : ""}
                  </p>
                </div>
                {!f.user_id && (
                  pendingInvite ? (
                    <button
                      type="button"
                      onClick={() => copyLink(f.id, pendingInvite.token)}
                      className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:border-primary"
                    >
                      {copiedId === f.id ? "Link copied!" : "Copy invite link again"}
                    </button>
                  ) : (
                    <InviteButton
                      onInvite={(email) => inviteFarmer(f.id, email)}
                      copied={copiedId === f.id}
                    />
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-6 text-sm font-medium text-ink-soft">People with access ({members.length})</h2>
      <div className="mt-2 space-y-1.5">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center justify-between rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm">
            <span className="text-ink-soft">{m.email}</span>
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs capitalize text-primary">
              {m.role.replace("_", " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InviteButton({ onInvite, copied }: { onInvite: (email: string) => void; copied: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-ink-soft hover:border-primary"
      >
        Invite to app
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="their email"
        className="w-32 rounded-lg border border-line-strong px-2 py-1 text-xs outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={() => {
          if (email) onInvite(email);
          setOpen(false);
        }}
        className="rounded-full bg-primary px-2.5 py-1.5 text-xs font-medium text-white"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
