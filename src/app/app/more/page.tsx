import Link from "next/link";
import { HeartPulse, Syringe, Pill, ShieldCheck, Receipt, Boxes, LineChart, Users, ChevronRight } from "lucide-react";

const ITEMS = [
  { href: "/app/health", label: "Health", desc: "Symptoms, treatment, vet visits", icon: HeartPulse },
  { href: "/app/vaccination", label: "Vaccination", desc: "Schedule and history", icon: Syringe },
  { href: "/app/medications", label: "Medications", desc: "Antibiotics, multivitamins, dewormers", icon: Pill },
  { href: "/app/biosecurity", label: "Biosecurity", desc: "Daily checklist and score", icon: ShieldCheck },
  { href: "/app/customers", label: "Customers", desc: "Names, contacts, and type", icon: Users },
  { href: "/app/expenses", label: "Expenses", desc: "Feed, medicine, labour, and more", icon: Receipt },
  { href: "/app/inventory", label: "Inventory & purchases", desc: "Stock levels and suppliers", icon: Boxes },
  { href: "/app/finance", label: "Finance", desc: "Revenue, costs, and profit", icon: LineChart },
];

export default function MorePage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-medium tracking-tight text-ink">More</h1>
      <div className="mt-4 space-y-2">
        {ITEMS.map((item) => {
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
