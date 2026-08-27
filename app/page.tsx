import Link from "next/link";
import ShardField from "@/components/ShardField";
import { SPORTS, SPORT_IDS } from "@/lib/sports";

/** NBA/NFL shield colours. The only three this page is allowed to use. */
const NAVY = "#17408b";
const NAVY_DEEP = "#0b1b3f";
const RED = "#c8102e";

export default function Home() {
  return (
    <main className="relative flex w-full flex-1 flex-col items-center justify-center overflow-hidden px-5 py-16">
      <ShardField />

      <div className="w-full max-w-md sm:max-w-xl">
        <header>
          <h1
            className="text-6xl font-extrabold uppercase leading-[0.85] tracking-[-0.045em] sm:text-8xl"
            style={{ color: NAVY_DEEP }}
          >
            Nash
          </h1>
          {/* One angled bar, cut to the same diagonal as the shards. */}
          <span
            aria-hidden
            className="mt-4 block h-2 w-40"
            style={{
              background: `linear-gradient(90deg, ${RED} 0% 50%, ${NAVY} 50% 100%)`,
              clipPath: "polygon(3% 0, 100% 0, 97% 100%, 0 100%)",
            }}
          />
          <p
            className="mt-5 max-w-sm text-[15px] font-medium leading-relaxed"
            style={{ color: "#43506e" }}
          >
            The roster lives here. Tap who showed up, get teams no swap can
            improve. No re-explaining everybody every single time.
          </p>
        </header>

        <nav className="mt-9 grid gap-3 sm:grid-cols-2">
          {SPORT_IDS.map((id, i) => {
            const sport = SPORTS[id];
            // Red and blue alternate across the tiles. A sport's own colour —
            // basketball red, football green — belongs to its own page; this
            // one is the shield palette and nothing else.
            const tone = i % 2 === 0 ? RED : NAVY;

            if (sport.comingSoon) {
              return (
                <div
                  key={id}
                  aria-disabled
                  className="flex items-center gap-4 rounded-lg border-2 border-dashed px-5 py-5 opacity-50"
                  style={{ borderColor: "#c3cbdd" }}
                >
                  <span aria-hidden className="text-3xl grayscale">
                    {sport.emoji}
                  </span>
                  <span className="flex-1">
                    <span className="block text-lg font-bold" style={{ color: NAVY_DEEP }}>
                      {sport.label}
                    </span>
                    <span className="block text-sm" style={{ color: "#5d6b8a" }}>
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
                className="group relative flex items-center gap-4 overflow-hidden rounded-lg px-5 py-5 shadow-[0_10px_28px_rgba(11,27,63,0.28)] transition hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(11,27,63,0.38)]"
                style={{ background: NAVY_DEEP }}
              >
                {/* The angled edge, so a tile is cut from the same cloth. */}
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-3"
                  style={{
                    background: tone,
                    clipPath: "polygon(0 0, 100% 0, 55% 100%, 0 100%)",
                  }}
                />
                <span aria-hidden className="ml-2 text-3xl">
                  {sport.emoji}
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold uppercase tracking-tight text-white">
                    {sport.label}
                  </span>
                  <span className="block text-sm text-white/70">
                    {sport.sideSize}-a-side · {sport.attributes.length} attributes
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-xl text-white/60 transition-transform group-hover:translate-x-1"
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
