import { createClient } from "@/lib/supabase/server";
import type { KnowledgeArticle } from "@/lib/database.types";

const CATEGORY_LABELS: Record<string, string> = {
  brooding: "Brooding",
  feeding: "Feeding",
  vaccination: "Vaccination",
  biosecurity: "Biosecurity",
  housing: "Housing",
  egg_handling: "Egg handling",
  disease_warning_signs: "Disease warning signs",
  marketing: "Marketing",
  record_keeping: "Record keeping",
  profitability: "Profitability",
  water_management: "Water management",
  welfare: "Welfare",
};

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

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
