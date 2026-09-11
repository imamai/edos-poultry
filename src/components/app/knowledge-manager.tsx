"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { KnowledgeArticle, KnowledgeCategory } from "@/lib/database.types";
import { categoryLabel } from "@/lib/knowledge-categories";

const CATEGORIES: KnowledgeCategory[] = [
  "brooding",
  "feeding",
  "vaccination",
  "biosecurity",
  "housing",
  "egg_handling",
  "disease_warning_signs",
  "marketing",
  "record_keeping",
  "profitability",
  "water_management",
  "welfare",
];

export function KnowledgeManager({ tenantId, articles }: { tenantId: string; articles: KnowledgeArticle[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const ownArticles = articles.filter((a) => a.tenant_id === tenantId);
  const globalArticles = articles.filter((a) => a.tenant_id === null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-soft">Your farm&apos;s advice articles</p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:border-primary"
          >
            + Add article
          </button>
        )}
      </div>

      {adding && <ArticleForm tenantId={tenantId} onDone={() => setAdding(false)} />}

      <div className="mt-3 space-y-2">
        {ownArticles.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-faint">
            No articles of your own yet — the Advice tab still shows the shared library below.
          </p>
        )}
        {ownArticles.map((a) =>
          editingId === a.id ? (
            <ArticleForm key={a.id} tenantId={tenantId} initial={a} onDone={() => setEditingId(null)} />
          ) : (
            <ArticleRow key={a.id} article={a} editable onEdit={() => setEditingId(a.id)} />
          ),
        )}
      </div>

      {globalArticles.length > 0 && (
        <>
          <p className="mt-6 text-sm font-medium text-ink-soft">Shared library (read-only)</p>
          <div className="mt-2 space-y-2">
            {globalArticles.map((a) => (
              <ArticleRow key={a.id} article={a} editable={false} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ArticleRow({ article, editable, onEdit }: { article: KnowledgeArticle; editable: boolean; onEdit?: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-paper-raised px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-dark">{categoryLabel(article.category)}</p>
          <p className="mt-1 font-medium text-ink">{article.title}</p>
        </div>
        {editable && (
          <button type="button" onClick={onEdit} className="shrink-0 text-xs text-primary hover:underline">
            Edit
          </button>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-ink-faint">{article.body}</p>
    </div>
  );
}

function ArticleForm({
  tenantId,
  initial,
  onDone,
}: {
  tenantId: string;
  initial?: KnowledgeArticle;
  onDone: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<KnowledgeCategory>(initial?.category ?? "record_keeping");
  const [body, setBody] = useState(initial?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const payload = { tenant_id: tenantId, title, category, body };
    const { error } = initial
      ? await supabase.from("poultryedos_knowledge_base").update(payload).eq("id", initial.id)
      : await supabase.from("poultryedos_knowledge_base").insert(payload);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-xl border border-line bg-paper-raised p-4">
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {categoryLabel(c)}
          </option>
        ))}
      </select>
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Guidance text — keep it practical, non-diagnostic advice"
        className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onDone} className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink-soft">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
