import Link from "next/link";
import { SPORTS, SPORT_IDS } from "@/lib/sports";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 px-5 py-16 sm:max-w-2xl">
      <header className="space-y-3">
        <h1 className="metal text-6xl leading-none">Nash</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          The roster lives here. Tap who showed up, get teams that are actually
          even. No re-explaining everybody every single time.
        </p>
      </header>

      <nav className="grid gap-3 sm:grid-cols-2">
        {SPORT_IDS.map((id) => {
          const sport = SPORTS[id];

          if (sport.comingSoon) {
            return (
              <div
                key={id}
                aria-disabled
                className="flex items-center gap-4 rounded-lg border border-dashed border-line-strong bg-sunken px-5 py-5 opacity-60"
              >
                <span aria-hidden className="text-3xl grayscale">
                  {sport.emoji}
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-semibold">
                    {sport.label}
                  </span>
                  <span className="block text-sm text-muted">Coming soon</span>
                </span>
              </div>
            );
          }

          return (
            <Link
              key={id}
              href={`/${id}`}
              className="group flex items-center gap-4 rounded-lg border border-line bg-surface px-5 py-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-accent hover:bg-raised"
            >
              <span aria-hidden className="text-3xl">
                {sport.emoji}
              </span>
              <span className="flex-1">
                <span className="block text-lg font-semibold">
                  {sport.label}
                </span>
                <span className="block text-sm text-muted">
                  {sport.sideSize}-a-side · {sport.attributes.length} attributes
                </span>
              </span>
              <span
                aria-hidden
                className="text-xl text-muted transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
