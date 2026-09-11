// Pure category-label lookup, deliberately separate from
// src/lib/data/knowledge.ts (which imports the server-only Supabase
// client via next/headers) so client components — like
// KnowledgeManager — can use it without pulling server code into the
// browser bundle.

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
