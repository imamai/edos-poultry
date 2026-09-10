import { notFound } from "next/navigation";
import Link from "next/link";
import { getKnowledgeArticle, categoryLabel } from "@/lib/data/knowledge";

export default async function AdviceArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getKnowledgeArticle(id);
  if (!article) notFound();

  return (
    <div>
      <Link href="/app/advice" className="text-sm text-ink-soft hover:text-primary">
        ← Advice
      </Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-accent-dark">
        {categoryLabel(article.category)}
      </p>
      <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-ink">{article.title}</h1>
      <p className="mt-4 whitespace-pre-line text-ink-soft">{article.body}</p>
    </div>
  );
}
