"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/onboarding";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push(next);
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-5 py-16 text-center sm:px-8">
        <h1 className="font-display text-2xl font-medium text-ink">Check your email</h1>
        <p className="mt-2 text-sm text-ink-soft">
          We sent a confirmation link to {email}. Confirm your address, then{" "}
          <Link
            href={next === "/onboarding" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
            className="text-primary hover:underline"
          >
            log in
          </Link>{" "}
          to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-5 py-16 sm:px-8">
      <h1 className="font-display text-2xl font-medium text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink-soft">Set up your farm on EDOS Poultry360.</p>

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
        <div>
          <label htmlFor="password" className="text-sm font-medium text-ink-soft">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-primary-dark disabled:opacity-60"
        >
          {busy ? "Creating account…" : "Continue"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link
          href={next === "/onboarding" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="text-primary hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
