import type { BiosecurityCheck } from "@/lib/database.types";

/** Pure calculation, kept separate from lib/data/business.ts (which pulls in
 * the server-only Supabase client) so client components can import this
 * without accidentally bundling server code. */
export function biosecurityScore(check: BiosecurityCheck): number {
  const fields = [
    check.footbath,
    check.visitor_control,
    check.ppe_used,
    check.cleaning_done,
    check.disinfection_done,
    check.rodent_control,
    check.dead_bird_disposal,
    check.feed_hygiene,
    check.water_sanitation,
  ];
  const trueCount = fields.filter(Boolean).length;
  return Math.round((trueCount / fields.length) * 100);
}
