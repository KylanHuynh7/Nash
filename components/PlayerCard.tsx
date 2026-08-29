"use client";

import { useEffect } from "react";
import { Button, Rating, ratingBar } from "@/components/ui";
import {
  RATING_MAX,
  RATING_MIN,
  formatHeight,
  type SportConfig,
} from "@/lib/sports";
import type { RosterEntry } from "@/app/actions";

/**
 * Read-only view of one player. Looking at a rating is the common case and
 * shouldn't cost a passcode — the gate belongs on changing one, which is why
 * Edit is the only thing in here that asks.
 */
export default function PlayerCard({
  config,
  player,
  rank,
  of,
  onClose,
  onEdit,
}: {
  config: SportConfig;
  player: RosterEntry;
  /** Where they sit on the board, so a number has something to mean. */
  rank: number;
  of: number;
  onClose: () => void;
  onEdit: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const position = config.positions.find((p) => p.key === player.position);
  const height = formatHeight(player.heightInches);

  /*
   * Attributes are shown in family groups, heaviest family first.
   *
   * This is not decoration. After the split, a per-attribute weight is
   * arithmetically true and communicatively false: speed carries x0.42 and
   * playmaking x1.00, so speed reads as mattering a quarter as much — when the
   * physicals *family* is 1.25, the heaviest thing in the sport. The three
   * children share one parent's weight; they did not each shrink.
   *
   * Sorting flat by weight made it worse, sinking the three physicals to the
   * bottom of the card as though they were the least important, when
   * athleticism used to sit at the very top.
   *
   * So the weight belongs on the family, and the family is what gets ordered.
   */
  const families = (() => {
    const byName = new Map<
      string,
      { name: string; weight: number; attributes: typeof config.attributes }
    >();
    for (const attr of config.attributes) {
      const name = attr.group ?? attr.label;
      const family = byName.get(name) ?? { name, weight: 0, attributes: [] };
      family.weight += attr.weight;
      family.attributes.push(attr);
      byName.set(name, family);
    }
    return [...byName.values()].sort((a, b) => b.weight - a.weight);
  })();

  const attributes = config.attributes;
  const best = attributes.reduce((top, a) =>
    (player.ratings[a.key] ?? 0) > (player.ratings[top.key] ?? 0) ? a : top,
  );
  const worst = attributes.reduce((low, a) =>
    (player.ratings[a.key] ?? 0) < (player.ratings[low.key] ?? 0) ? a : low,
  );
  // Ties made these arbitrary: three seeded physicals sit on the same number,
  // and only one of them was being tagged. A flag that cannot pick a winner
  // should not show one.
  const bestTied =
    attributes.filter(
      (a) => (player.ratings[a.key] ?? 0) === (player.ratings[best.key] ?? 0),
    ).length > 1;
  const worstTied =
    attributes.filter(
      (a) => (player.ratings[a.key] ?? 0) === (player.ratings[worst.key] ?? 0),
    ).length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-8 shadow-[var(--shadow-lift)] sm:rounded-3xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} ratings`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{player.name}</h2>
            <p className="text-sm text-muted">
              {position?.full ?? player.position}
              {height && <> · {height}</>} · #{rank} of {of}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-xl leading-none text-muted transition hover:bg-sunken hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent-line bg-accent-wash px-4 py-3">
          <Rating value={player.overall} />
          <div className="text-sm">
            <p className="font-medium">Overall</p>
            <p className="text-xs text-muted">
              Weighted mean · {RATING_MIN} is the lowest of these {of}, {RATING_MAX} the highest
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          {families.map((family) => (
            <section key={family.name}>
              {/* The weight lives here, on the family, because that is the
                  number the overall actually applies. A family of one prints
                  the same value it always did. */}
              <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line pb-1">
                <h3 className="eyebrow">{family.name}</h3>
                <span className="font-mono text-[10px] tabular-nums text-muted">
                  ×{family.weight.toFixed(2)}
                </span>
              </div>
              <ul className="grid gap-2.5">
                {family.attributes.map((attr) => {
                  const value = player.ratings[attr.key] ?? RATING_MIN;
                  // Fill spans the group's range, not 0-99, so a 70 doesn't read
                  // as "70% good" when it's really the bottom of this roster.
                  const pct = Math.max(
                    2,
                    ((value - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100,
                  );
                  return (
                    <li key={attr.key}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">
                          {attr.label}
                          {attr.key === best.key && !bestTied && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                              best
                            </span>
                          )}
                          {attr.key === worst.key &&
                            !worstTied &&
                            best.key !== worst.key && (
                              <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                weakest
                              </span>
                            )}
                        </span>
                        <Rating value={value} size="sm" />
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                        <div
                          className={`h-full rounded-full ${ratingBar(value)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs leading-snug text-muted">
                        {attr.hint}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Done
          </Button>
          <Button variant="ghost" onClick={onEdit} className="flex-1">
            Edit ratings
          </Button>
        </div>
      </div>
    </div>
  );
}
