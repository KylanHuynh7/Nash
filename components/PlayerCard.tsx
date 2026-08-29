"use client";

import { useEffect, useState } from "react";
import { Button, Rating, ratingBar } from "@/components/ui";
import {
  RATING_MAX,
  RATING_MIN,
  formatHeight,
  type SportConfig,
} from "@/lib/sports";
import { getPlayerComps, type RosterEntry } from "@/app/actions";

type Comp = Awaited<ReturnType<typeof getPlayerComps>>[number];

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
  roster,
}: {
  config: SportConfig;
  player: RosterEntry;
  /**
   * The whole roster, so a comparison needs no second fetch.
   *
   * Only the head-to-head RECORD comes from the server; the opponent's numbers
   * are already in memory behind this modal.
   */
  roster: RosterEntry[];
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

  /*
   * Who the group argued about, fetched when the card opens.
   *
   * On open rather than precomputed with the roster: opening a card is a
   * deliberate act, and aggregating every player's head-to-head on every
   * roster render would be work nobody asked for.
   */
  const [comps, setComps] = useState<Comp[] | null>(null);
  const [against, setAgainst] = useState<RosterEntry | null>(null);

  useEffect(() => {
    let live = true;
    // No synchronous reset here: SportApp keys this modal by player id, so
    // opening a different card remounts with fresh state. Clearing it inline
    // instead would set state during the effect and cascade a render.
    getPlayerComps(config.id, player.id)
      .then((rows) => live && setComps(rows))
      // A missing comps section is a smaller failure than a card that will not
      // open, so this degrades to nothing rather than throwing.
      .catch(() => live && setComps([]));
    return () => {
      live = false;
    };
  }, [config.id, player.id]);

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
              Weighted mean · {RATING_MIN} is the lowest of these {of},{" "}
              {RATING_MAX} the highest
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

        {comps && comps.length > 0 && (
          <section className="mt-5">
            <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line pb-1">
              <h3 className="eyebrow">Comps</h3>
              <span className="text-[10px] text-muted">
                what the group said
              </span>
            </div>
            {/* Ranked by how split the vote was, not by who sits nearest in
                the ratings. A 2-2 is an argument; a 4-0 is a table. */}
            <p className="mb-2.5 text-xs leading-snug text-muted">
              Closest calls from {of - 1} teammates — who the group
              couldn&apos;t agree on.
            </p>
            <ul className="grid gap-2">
              {comps.slice(0, 3).map((comp) => {
                const other = roster.find((r) => r.id === comp.opponentId);
                if (!other) return null;
                const open = against?.id === other.id;
                return (
                  <li key={comp.opponentId}>
                    <button
                      type="button"
                      onClick={() => setAgainst(open ? null : other)}
                      aria-expanded={open}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        open
                          ? "border-accent bg-raised"
                          : "border-line bg-sunken hover:border-accent/50"
                      }`}
                    >
                      <span className="min-w-0 truncate text-sm font-medium">
                        vs {other.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-xs tabular-nums text-muted">
                          {comp.wins}&ndash;{comp.losses}
                          {comp.ties > 0 && ` (${comp.ties} tie)`}
                        </span>
                        <span className="text-xs text-ink-soft">
                          {open ? "−" : "+"}
                        </span>
                      </span>
                    </button>
                    {open && (
                      <SideBySide
                        left={player}
                        right={other}
                        families={families}
                        comp={comp}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

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

/**
 * Two players' numbers next to each other, one family at a time.
 *
 * The interesting line is not who is higher — it is where the group's verdict
 * and the stored ratings DISAGREE. Those ratings are one person's; the record
 * is six people's, and about one pair in six comes back the other way (§0
 * measured 82.7% agreement). A comp where they agree is a table. A comp where
 * they diverge is the argument this section exists to start.
 *
 * Family averages, not the fifteen raw numbers, because a family is what the
 * overall actually weights and fifteen rows of ±2 is noise wearing detail's
 * costume. The per-attribute values stay one tap away on each card.
 */
function SideBySide({
  left,
  right,
  families,
  comp,
}: {
  left: RosterEntry;
  right: RosterEntry;
  families: {
    name: string;
    weight: number;
    attributes: SportConfig["attributes"];
  }[];
  comp: Comp;
}) {
  const avg = (p: RosterEntry, attrs: SportConfig["attributes"]) =>
    attrs.reduce((n, a) => n + (p.ratings[a.key] ?? RATING_MIN), 0) /
    attrs.length;

  // Ratings say one thing, the group said another. Ties count as half, the
  // same way the ranking treats them.
  const crowdFavoursLeft = comp.wins + comp.ties / 2 > comp.votes / 2;
  const ratingFavoursLeft = left.overall > right.overall;
  const split =
    left.overall !== right.overall && crowdFavoursLeft !== ratingFavoursLeft;

  return (
    <div className="mt-2 rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 text-xs">
        <span className="truncate font-semibold">{left.name}</span>
        <span className="eyebrow">overall</span>
        <span className="truncate text-right font-semibold">{right.name}</span>
      </div>
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Rating value={left.overall} size="sm" />
        <span className="font-mono text-[10px] tabular-nums text-muted">
          {left.overall - right.overall > 0 ? "+" : ""}
          {left.overall - right.overall}
        </span>
        <div className="flex justify-end">
          <Rating value={right.overall} size="sm" />
        </div>
      </div>

      <ul className="grid gap-1.5">
        {families.map((family) => {
          const l = avg(left, family.attributes);
          const r = avg(right, family.attributes);
          const lead =
            Math.abs(l - r) < 0.5 ? "even" : l > r ? "left" : "right";
          return (
            <li
              key={family.name}
              className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 text-xs"
            >
              <span
                className={`text-left font-mono tabular-nums ${lead === "left" ? "font-semibold text-foreground" : "text-muted"}`}
              >
                {l.toFixed(0)}
              </span>
              <span className="truncate text-center text-[11px] text-muted">
                {family.name}
              </span>
              <span
                className={`text-right font-mono tabular-nums ${lead === "right" ? "font-semibold text-foreground" : "text-muted"}`}
              >
                {r.toFixed(0)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t border-line pt-2 text-xs leading-snug text-muted">
        {split ? (
          <>
            Ratings have{" "}
            <span className="font-semibold text-foreground">
              {ratingFavoursLeft ? left.name : right.name}
            </span>
            , but the group took{" "}
            <span className="font-semibold text-accent">
              {crowdFavoursLeft ? left.name : right.name}
            </span>{" "}
            {/* The winner's tally leads. `comp` counts from the focal player,
                so printing it raw said "the group took Justin 1-2" — the
                winner's own record shown as a loss. */}
            {Math.max(comp.wins, comp.losses)}&ndash;
            {Math.min(comp.wins, comp.losses)} of {comp.votes}.
          </>
        ) : (
          <>
            {comp.votes} teammates weighed in
            {comp.wins === comp.losses ? (
              <>
                {" "}
                and split{" "}
                <span className="font-semibold text-foreground">
                  {comp.wins}&ndash;{comp.losses}
                </span>
                .
              </>
            ) : (
              <>
                , taking{" "}
                <span className="font-semibold text-foreground">
                  {comp.wins > comp.losses ? left.name : right.name}
                </span>{" "}
                {Math.max(comp.wins, comp.losses)}&ndash;
                {Math.min(comp.wins, comp.losses)}.
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
