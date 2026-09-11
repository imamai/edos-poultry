import { getMyMembership } from "@/lib/data/farmer";
import { getKnowledgeArticles } from "@/lib/data/knowledge";
import { getAnnouncements } from "@/lib/data/cms";
import { KnowledgeManager } from "@/components/app/knowledge-manager";
import { AnnouncementManager } from "@/components/app/announcement-manager";

export default async function ContentPage() {
  const membership = await getMyMembership();
  if (!membership) return null;
  if (membership.role !== "owner" && membership.role !== "admin") {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-ink-soft">
        Only owners and admins manage content.
      </div>
    );
  }

  const [articles, announcements] = await Promise.all([
    getKnowledgeArticles(membership.tenant.id),
    getAnnouncements(membership.tenant.id),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Content</h1>
      <p className="mt-1 text-sm text-ink-soft">Manage your farm&apos;s own advice articles and announcements.</p>

      <div className="mt-6">
        <KnowledgeManager tenantId={membership.tenant.id} articles={articles} />
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <AnnouncementManager tenantId={membership.tenant.id} announcements={announcements} />
      </div>
    </div>
  );
}
