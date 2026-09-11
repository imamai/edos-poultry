import { getMyFarmerContext, getAllFlocks } from "@/lib/data/farmer";
import { getExpenseCategories, getRecentExpenses } from "@/lib/data/business";
import { ExpenseManager } from "@/components/app/expense-manager";

export default async function ExpensesPage() {
  const context = await getMyFarmerContext();
  if (!context) return null;

  const [categories, expenses, flocks] = await Promise.all([
    getExpenseCategories(context.tenant.id),
    getRecentExpenses(context.tenant.id),
    getAllFlocks(context.farm.id),
  ]);

  return (
    <ExpenseManager
      tenantId={context.tenant.id}
      flocks={flocks}
      defaultFlockId={context.flock?.id ?? null}
      currency={context.tenant.currency}
      categories={categories}
      expenses={expenses}
    />
  );
}
