"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface InviteInfo {
  invite_id: string;
  status: string;
  farmer_name: string;
  tenant_name: string;
  email: string;
}

export function InviteAcceptance({
  token,
  invite,
  isLoggedIn,
}: {
  token: string;
  invite: InviteInfo | null;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!invite) {
    return (
      <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-5 py-16 text-center sm:px-8">
        <h1 className="font-display text-2xl font-medium text-ink">Invite not found</h1>
        <p className="mt-2 text-sm text-ink-soft">This link may have expired.</p>
      </div>
    );
  }

  if (invite.status === "accepted") {
    return (
      <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-5 py-16 text-center sm:px-8">
        <h1 className="font-display text-2xl font-medium text-ink">Already accepted</h1>
        <p className="mt-2 text-sm text-ink-soft">
          This invite has already been used.{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>{" "}
          instead.
        </p>
      </div>
    );
  }

  async function handleAccept() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("poultryedos_accept_farmer_invite", { p_token: token });
    setBusy(false);
    if (error) {
      if (error.message.includes("farmer_already_claimed")) {
        setError("This farmer profile is already linked to an account.");
      } else if (error.message.includes("already_a_farmer_in_tenant")) {
        setError(
          "You're already registered as a different farmer on this account. This invite is for someone else — open it from their device or account instead, or ask them to open it themselves.",
        );
      } else {
        setError(error.message);
      }
      return;
    }
    router.push("/app/home");
    router.refresh();
  }

  const next = `/invite/${token}`;

  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-5 py-16 text-center sm:px-8">
      <h1 className="font-display text-2xl font-medium text-ink">You&apos;re invited</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {invite.tenant_name} has added you as <strong>{invite.farmer_name}</strong>. Accept to
        get your own login and start recording your own farm data.
      </p>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {isLoggedIn ? (
        <button
          type="button"
          disabled={busy}
          onClick={handleAccept}
          className="mt-6 w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {busy ? "Joining…" : "Accept & join"}
        </button>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Create account to accept
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="rounded-full border border-line-strong px-6 py-3 text-sm font-medium text-ink-soft hover:border-primary"
          >
            I already have an account
          </Link>
        </div>
      )}
    </div>
  );
}
