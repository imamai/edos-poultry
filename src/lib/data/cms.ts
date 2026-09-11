import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/lib/database.types";

export async function getAnnouncements(tenantId: string): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_announcements")
    .select("*")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

/** Announcements currently "live" (started, not yet ended) — for the small
 * banner shown on the farmer home page and admin `/app/more`. */
export function activeAnnouncements(announcements: Announcement[], now: Date = new Date()): Announcement[] {
  return announcements.filter((a) => {
    const started = new Date(a.starts_at).getTime() <= now.getTime();
    const notEnded = !a.ends_at || new Date(a.ends_at).getTime() >= now.getTime();
    return started && notEnded;
  });
}
