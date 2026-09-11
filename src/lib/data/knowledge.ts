import { createClient } from "@/lib/supabase/server";
import type { KnowledgeArticle } from "@/lib/database.types";

export { categoryLabel } from "@/lib/knowledge-categories";

export async function getKnowledgeArticles(tenantId: string): Promise<KnowledgeArticle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("poultryedos_knowledge_base")
    .select("*")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("category");

  if (error) throw error;
  return (data ?? []) as KnowledgeArticle[];
}

export async function getKnowledgeArticle(id: string): Promise<KnowledgeArticle | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("poultryedos_knowledge_base").select("*").eq("id", id).maybeSingle();
  return (data as KnowledgeArticle) ?? null;
}
