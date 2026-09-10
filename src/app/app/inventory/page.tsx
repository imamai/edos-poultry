import { getMyFarmerContext } from "@/lib/data/farmer";
import { getInventoryItems, getSuppliers, getRecentPurchaseOrders } from "@/lib/data/business";
import { InventoryManager } from "@/components/app/inventory-manager";

export default async function InventoryPage() {
  const context = await getMyFarmerContext();
  if (!context) return null;

  const [items, suppliers, purchaseOrders] = await Promise.all([
    getInventoryItems(context.tenant.id),
    getSuppliers(context.tenant.id),
    getRecentPurchaseOrders(context.tenant.id),
  ]);

  return (
    <InventoryManager
      tenantId={context.tenant.id}
      currency={context.tenant.currency}
      items={items}
      suppliers={suppliers}
      purchaseOrders={purchaseOrders}
    />
  );
}
