import Link from "next/link";
import { getMyFarmerContext } from "@/lib/data/farmer";
import { getKnowledgeArticles, categoryLabel } from "@/lib/data/knowledge";

export default async function AdvicePage() {
  const context = await getMyFarmerContext();
  if (!context) return null;

  const articles = await getKnowledgeArticles(context.tenant.id);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">Advice</h1>
      <p className="mt-1 text-sm text-ink-soft">Practical guidance for keeping healthy, productive birds.</p>

      <div className="mt-4 space-y-2">
        {articles.map((a) => (
          <Link
            key={a.id}
            href={`/app/advice/${a.id}`}
            className="block rounded-xl border border-line bg-paper-raised px-4 py-3 hover:border-primary"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-accent-dark">
              {categoryLabel(a.category)}
            </p>
            <p className="mt-1 font-medium text-ink">{a.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
