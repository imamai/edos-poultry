import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <span className="font-display text-lg font-medium text-ink">EDOS Poultry360</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-ink-soft hover:text-ink">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-ink px-4 py-2 font-medium text-paper hover:bg-primary-dark"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto flex max-w-3xl flex-1 flex-col items-center px-5 py-20 text-center sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wide text-accent-dark">
          Built for poultry farmers in Kenya
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Manage every flock. Every farmer. Every decision.
        </h1>
        <p className="mt-4 max-w-xl text-ink-soft">
          Record your farm&apos;s day in under a minute, even offline. See what needs your
          attention today, not just numbers on a screen.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white shadow-card hover:bg-primary-dark"
          >
            Set up your farm
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-line-strong px-6 py-3 text-sm font-medium text-ink-soft hover:border-primary"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="border-t border-line bg-paper-raised">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 py-16 sm:grid-cols-3 sm:px-8">
          {[
            {
              title: "60-second daily record",
              body: "Deaths, eggs, feed, sales — the numbers that matter, recorded fast, even with no signal.",
            },
            {
              title: "Works offline",
              body: "Record on the farm without a connection. It syncs automatically the moment you're back online.",
            },
            {
              title: "Alerts you can trust",
              body: "We tell you when mortality is above your own farm's normal — and recommend a vet review, never a diagnosis.",
            },
          ].map((f) => (
            <div key={f.title}>
              <h2 className="font-display text-lg font-medium text-ink">{f.title}</h2>
              <p className="mt-2 text-sm text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
