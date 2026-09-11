import Link from "next/link";
import { Egg, Skull, Wheat, Wallet, TriangleAlert, Syringe, Megaphone } from "lucide-react";
import { getMyFarmerContext, getRecentDailyRecords, getUpcomingVaccinations, computeMortalityAlert, resolveSelectedFlock } from "@/lib/data/farmer";
import { getAnnouncements, activeAnnouncements } from "@/lib/data/cms";
import { formatMoney } from "@/lib/money";
import { FlockSwitcher } from "@/components/app/flock-switcher";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function FarmerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ flock?: string }>;
}) {
  const context = await getMyFarmerContext();
  if (!context) return null;
  const { farmer, tenant } = context;
  const { flock: requestedFlockId } = await searchParams;

  const hour = Number(
    new Intl.DateTimeFormat("en-KE", { hour: "numeric", hour12: false, timeZone: tenant.timezone }).format(
      new Date(),
    ),
  );

  const { flock, allFlocks } = await resolveSelectedFlock(context.farm.id, requestedFlockId);

  if (!flock) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-8 text-center">
        <p className="text-ink-soft">No active flock yet.</p>
        <p className="mt-1 text-sm text-ink-faint">Add a flock to start recording production.</p>
      </div>
    );
  }

  const records = await getRecentDailyRecords(flock.id, 8);
  const todayDate = new Date().toISOString().slice(0, 10);
  const today = records[0]?.record_date === todayDate ? records[0] : undefined;
  const vaccinations = await getUpcomingVaccinations(flock.id);
  const alert = today ? computeMortalityAlert(records) : null;
  const announcements = activeAnnouncements(await getAnnouncements(tenant.id));

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

      <FlockSwitcher flocks={allFlocks} selectedId={flock.id} />

      {announcements[0] && (
        <div className="flex items-start gap-3 rounded-xl border border-line bg-accent-soft p-4">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-accent-dark" />
          <div>
            <p className="text-sm font-medium text-ink">{announcements[0].title}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{announcements[0].body}</p>
          </div>
        </div>
      )}

      {alert && (
        <div className="flex items-start gap-3 rounded-xl border border-danger bg-danger-soft p-4">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <p className="text-sm text-danger">{alert.message}</p>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-ink-soft">
          {allFlocks.length > 1 ? `${flock.batch_code} today` : "Your farm today"}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={<Skull className="h-5 w-5 text-danger" />} label="Birds alive" value={String(flock.current_quantity)} />
          <StatCard icon={<Egg className="h-5 w-5 text-accent-dark" />} label="Eggs today" value={todayEggs === null ? "—" : String(todayEggs)} />
          <StatCard icon={<Wheat className="h-5 w-5 text-primary" />} label="Feed used" value={todayFeed === null ? "—" : `${todayFeed} kg`} />
          <StatCard icon={<Wallet className="h-5 w-5 text-success" />} label="Sales today" value={formatMoney(todaySales, tenant.currency)} />
        </div>
        {!today && (
          <p className="mt-2 text-xs text-ink-faint">
            You haven&apos;t recorded today yet.{" "}
            <Link href={`/app/record?flock=${flock.id}`} className="text-primary hover:underline">
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
        href={`/app/record?flock=${flock.id}`}
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
