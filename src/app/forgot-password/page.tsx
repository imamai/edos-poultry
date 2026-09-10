"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-5 py-16 text-center sm:px-8">
        <h1 className="font-display text-2xl font-medium text-ink">Check your email</h1>
        <p className="mt-2 text-sm text-ink-soft">
          If an account exists for {email}, a password reset link is on its way.
        </p>
        <Link href="/login" className="mt-6 text-sm text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-5 py-16 sm:px-8">
      <h1 className="font-display text-2xl font-medium text-ink">Reset your password</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-ink-soft">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-primary-dark disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/login" className="text-primary hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
