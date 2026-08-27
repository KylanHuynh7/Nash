import Link from "next/link";
import { SPORTS, SPORT_IDS } from "@/lib/sports";

export default function Home() {
  return (
    <main className="relative flex w-full flex-1 flex-col items-center justify-center px-5 py-16">
      {/*
       * Red is a core rather than a wash: it sits lit behind the middle of the
       * page and falls off to black at the edges, so the black frames the thing
       * instead of being the thing.
       */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(34rem 24rem at 42% 34%, #ff2440 0%, #d50a0a 30%, rgba(150,10,30,0.5) 52%, rgba(60,10,30,0.18) 70%, transparent 82%)",
          }}
        />
        {/* A breath of league blue so the palette is three colours, not two. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(38rem 26rem at 82% 88%, rgba(45,90,220,0.4) 0%, transparent 62%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(105% 90% at 42% 36%, transparent 18%, rgba(4,5,10,0.68) 58%, #04050a 86%)",
          }}
        />
      </div>

      <div className="w-full max-w-md sm:max-w-2xl">
        <header className="space-y-5">
          <div>
            <h1 className="text-7xl font-extrabold uppercase leading-none tracking-[-0.04em] text-white [text-shadow:0_2px_34px_rgba(0,0,0,0.5)]">
              Nash
            </h1>
            {/* Shield underline. On a red ground the red segment only survives
                against the dark rail behind it. */}
            <span
              aria-hidden
              className="mt-3 flex h-1.5 w-44 overflow-hidden rounded-full bg-black/45 ring-1 ring-black/40"
            >
              <span className="h-full flex-1 bg-[#ff2e40]" />
              <span className="h-full flex-1 bg-white" />
              <span className="h-full flex-1 bg-[#4d7dff]" />
            </span>
          </div>

          <p className="max-w-md text-[15px] leading-relaxed text-white/85">
            The roster lives here. Tap who showed up, get teams no swap can
            improve. No re-explaining everybody every single time.
          </p>
        </header>

        <nav className="mt-10 grid gap-3 sm:grid-cols-2">
          {SPORT_IDS.map((id) => {
            const sport = SPORTS[id];

            if (sport.comingSoon) {
              return (
                <div
                  key={id}
                  aria-disabled
                  className="flex items-center gap-4 rounded-xl border border-dashed border-white/35 bg-white/10 px-5 py-5 opacity-70 backdrop-blur-md"
                >
                  <span aria-hidden className="text-3xl grayscale">
                    {sport.emoji}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg font-semibold text-white">
                      {sport.label}
                    </span>
                    <span className="block text-sm text-white/70">
                      Coming soon
                    </span>
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={id}
                href={`/${id}`}
                // Frosted white rather than a dark panel: on a lit ground the
                // white is what reads, and it lets each sport's own colour show
                // through as a tint instead of competing with a black card.
                className="group relative flex items-center gap-4 overflow-hidden rounded-xl bg-white px-5 py-5 shadow-[0_14px_40px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_52px_rgba(0,0,0,0.55)]"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-2"
                  style={{ background: sport.accent }}
                />
                <span aria-hidden className="ml-1.5 text-3xl">
                  {sport.emoji}
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold tracking-tight text-[#0a1233]">
                    {sport.label}
                  </span>
                  <span className="block text-sm text-[#5a6486]">
                    {sport.sideSize}-a-side · {sport.attributes.length} attributes
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-xl text-[#8790ad] transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
