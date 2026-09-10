import Link from "next/link";
import { Egg, Skull, Wheat, Wallet, TriangleAlert, Syringe } from "lucide-react";
import { getMyFarmerContext, getRecentDailyRecords, getUpcomingVaccinations, computeMortalityAlert } from "@/lib/data/farmer";
import { formatMoney } from "@/lib/money";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function FarmerHomePage() {
  const context = await getMyFarmerContext();
  if (!context) return null;
  const { farmer, flock, tenant } = context;

  const hour = Number(
    new Intl.DateTimeFormat("en-KE", { hour: "numeric", hour12: false, timeZone: tenant.timezone }).format(
      new Date(),
    ),
  );

  if (!flock) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center">
        <p className="text-ink-soft">No active flock yet.</p>
        <p className="mt-1 text-sm text-ink-faint">Add a flock to start recording production.</p>
      </div>
    );
  }

  const records = await getRecentDailyRecords(flock.id, 8);
  const [today] = records;
  const vaccinations = await getUpcomingVaccinations(flock.id);
  const alert = computeMortalityAlert(records);

  const todayEggs = today?.eggs_collected ?? null;
  const todaySales = today?.sales_amount_cents ?? 0;
  const todayFeed = today?.feed_consumed_kg ?? null;
  const todayMortality = today?.mortality ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-faint">{greeting(hour)},</p>
        <h1 className="font-display text-2xl font-medium text-ink">{farmer.full_name.split(" ")[0]}</h1>
      </div>

      {alert && (
        <div className="flex items-start gap-3 rounded-xl border border-danger bg-danger-soft p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <p className="text-sm text-danger">{alert.message}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-ink-soft">Your farm today</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <StatCard icon={<Skull className="h-5 w-5 text-danger" />} label="Birds alive" value={String(flock.current_quantity)} />
          <StatCard icon={<Egg className="h-5 w-5 text-accent-dark" />} label="Eggs today" value={todayEggs === null ? "—" : String(todayEggs)} />
          <StatCard icon={<Wheat className="h-5 w-5 text-primary" />} label="Feed used" value={todayFeed === null ? "—" : `${todayFeed} kg`} />
          <StatCard icon={<Wallet className="h-5 w-5 text-success" />} label="Sales today" value={formatMoney(todaySales, tenant.currency)} />
        </div>
        {!today && (
          <p className="mt-2 text-xs text-ink-faint">
            You haven&apos;t recorded today yet.{" "}
            <Link href="/app/record" className="text-primary hover:underline">
              Record today&apos;s numbers →
            </Link>
          </p>
        )}
        {todayMortality > 0 && (
          <p className="mt-2 text-xs text-ink-faint">{todayMortality} bird(s) lost today.</p>
        )}
      </div>

      {vaccinations.length > 0 && (
        <div className="rounded-xl border border-line bg-paper-raised p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <Syringe className="h-4 w-4" /> Upcoming vaccination
          </p>
          <p className="mt-1 text-sm text-ink">
            {vaccinations[0].vaccine_name} — due{" "}
            {new Date(vaccinations[0].scheduled_date).toLocaleDateString("en-KE", {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
      )}

      <Link
        href="/app/record"
        className="block rounded-full bg-primary px-6 py-3.5 text-center text-sm font-medium text-white shadow-card hover:bg-primary-dark"
      >
        Record today&apos;s numbers
      </Link>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper-raised p-4">
      <div className="flex items-center gap-2 text-ink-faint">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-medium text-ink">{value}</p>
    </div>
  );
}
