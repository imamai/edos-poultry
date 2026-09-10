"use client";

/** Shared building blocks for the "hidden print:block" report views used by
 * Flock and Sales — a plain, high-contrast layout meant to look right on
 * paper or as a browser "Save as PDF" export, not the interactive card UI. */

export function PrintHeader({
  tenantName,
  subtitle,
  title,
}: {
  tenantName: string;
  subtitle?: string;
  title: string;
}) {
  const printedOn = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="border-b border-black/30 pb-3">
      <p className="text-lg font-semibold">{tenantName}</p>
      {subtitle && <p className="text-sm">{subtitle}</p>}
      <p className="mt-2 text-xl font-semibold">{title}</p>
      <p className="text-xs text-black/60">Printed {printedOn}</p>
    </div>
  );
}

export function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 break-inside-avoid">
      <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  );
}

export function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-black/10 py-1 text-sm">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
