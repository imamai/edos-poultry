import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client that bypasses RLS entirely. Used ONLY by the M-Pesa
 * callback route (src/app/api/mpesa/callback/route.ts), which Safaricom
 * calls with no Supabase session at all — there is no authenticated user to
 * run a normal request-scoped client as. Never import this from a Client
 * Component or anywhere that could bundle it into browser code; the
 * service-role key must never reach the browser (see PRODUCT_SPEC.md §70).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
