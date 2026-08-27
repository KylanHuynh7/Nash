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
        {/*
         * A directional sweep rather than a centred radial: a circle of red on
         * black reads as a spotlight blob, where a diagonal falloff reads as a
         * lit surface. Red owns the top-left two thirds and black is only ever
         * the far corner.
         */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(128deg, #ff2c3f 0%, #e8102a 18%, #b90d22 34%, #7a0d1e 50%, #3d0a15 66%, #14070c 82%, #07070b 100%)",
          }}
        />
        {/* Light source, top-left, so the sweep has somewhere to come from. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60rem 44rem at 16% 6%, rgba(255,120,120,0.42) 0%, rgba(255,60,70,0.14) 34%, transparent 64%)",
          }}
        />
        {/* League blue, kept to the shadow where it deepens rather than tints. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(52rem 40rem at 96% 96%, rgba(38,74,200,0.5) 0%, rgba(20,40,120,0.18) 40%, transparent 70%)",
          }}
        />
        {/* Corner vignette only — the frame, not the field. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(140% 120% at 40% 30%, transparent 52%, rgba(4,5,10,0.55) 84%, rgba(4,5,10,0.8) 100%)",
          }}
        />
      </div>

      <div className="w-full max-w-md sm:max-w-2xl">
        <header className="space-y-5">
          <div>
            <h1 className="text-7xl font-extrabold uppercase leading-none tracking-[-0.04em] text-white [text-shadow:0_2px_34px_rgba(0,0,0,0.5)]">
              Nash
            </h1>
            {/* One white rule. Three colours side by side read as a flag. */}
            <span
              aria-hidden
              className="mt-4 block h-1 w-24 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.55)]"
            />
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
