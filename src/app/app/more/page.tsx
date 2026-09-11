import Link from "next/link";
import {
  HeartPulse,
  Syringe,
  Pill,
  ShieldCheck,
  Receipt,
  Boxes,
  LineChart,
  Users,
  ChevronRight,
  CreditCard,
  FileText,
  FileBarChart,
  Sparkles,
  Bot,
  LayoutDashboard,
  ShieldAlert,
  Store,
} from "lucide-react";
import { getMyMembership, getMyFarmerContext } from "@/lib/data/farmer";
import { isSuperAdmin } from "@/lib/data/super-admin";

type MoreItem = { href: string; label: string; desc: string; icon: typeof HeartPulse };

const INTELLIGENCE_ITEMS: MoreItem[] = [
  { href: "/app/decisions", label: "What needs my attention?", desc: "Alerts grouped by priority", icon: Sparkles },
  { href: "/app/assistant", label: "Ask about your farm", desc: "Answers grounded in your own data", icon: Bot },
];

const FARMER_ITEMS: MoreItem[] = [
  { href: "/app/health", label: "Health", desc: "Symptoms, treatment, vet visits", icon: HeartPulse },
  { href: "/app/vaccination", label: "Vaccination", desc: "Schedule and history", icon: Syringe },
  { href: "/app/medications", label: "Medications", desc: "Antibiotics, multivitamins, dewormers", icon: Pill },
  { href: "/app/biosecurity", label: "Biosecurity", desc: "Daily checklist and score", icon: ShieldCheck },
  { href: "/app/customers", label: "Customers", desc: "Names, contacts, and type", icon: Users },
  { href: "/app/expenses", label: "Expenses", desc: "Feed, medicine, labour, and more", icon: Receipt },
  { href: "/app/inventory", label: "Inventory & purchases", desc: "Stock levels and suppliers", icon: Boxes },
  { href: "/app/finance", label: "Finance", desc: "Revenue, costs, and profit", icon: LineChart },
];

export default async function MorePage() {
  const membership = await getMyMembership();
  if (!membership) return null;
  const farmerContext = await getMyFarmerContext();
  const isOwnerOrAdmin = membership.role === "owner" || membership.role === "admin";

  const items: MoreItem[] = [];
  if (await isSuperAdmin()) {
    items.push({ href: "/app/superadmin", label: "Super Admin", desc: "Every tenant on the platform", icon: ShieldAlert });
  }
  items.push(...INTELLIGENCE_ITEMS);
  // Not gated on farmerContext, unlike FARMER_ITEMS below — browsing the
  // public board has value even before a farm exists to post from.
  items.push({ href: "/app/marketplace", label: "Marketplace", desc: "List or browse eggs, birds, manure, feed", icon: Store });
  if (farmerContext) items.push(...FARMER_ITEMS);
  if (isOwnerOrAdmin) {
    items.push({ href: "/app/billing", label: "Billing", desc: "Plan, usage, and payments", icon: CreditCard });
    items.push({ href: "/app/content", label: "Content", desc: "Advice articles and announcements", icon: FileText });
    // The admin bottom nav already has dedicated Network/Team/Reports tabs
    // — only add them here for a farmer-owner (has their own farmer
    // profile, so the bottom nav shows the farmer variant instead), who'd
    // otherwise have no way to reach the farmers they manage or the
    // network-wide rollup at all.
    if (farmerContext) {
      items.push({ href: "/app/network", label: "Network", desc: "Roll-up across every farmer you manage", icon: LayoutDashboard });
      items.push({ href: "/app/team", label: "Team", desc: "Farmers you manage and who has access", icon: Users });
      items.push({ href: "/app/reports", label: "Reports", desc: "Production, mortality, and financial reports", icon: FileBarChart });
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">More</h1>
      <div className="mt-4 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl border border-line bg-paper-raised px-4 py-3 hover:border-primary"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-ink">{item.label}</span>
                <span className="block text-xs text-ink-faint">{item.desc}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-ink-faint" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
