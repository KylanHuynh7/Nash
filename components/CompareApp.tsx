"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { submitComparison } from "@/app/actions";
import type { AxisBootstrap } from "@/app/actions";
import { rememberToken } from "@/components/CompareLinkGate";
import SportShards from "@/components/SportShards";
import {
  anchorPairs,
  blockTargets,
  nextPair,
  pairKey,
  seedFor,
  type ComparePlayer,
  type Pair,
} from "@/lib/compare";
import type { Rater } from "@/lib/rater";
import type { CompareAxis, SportConfig } from "@/lib/sports";

/**
 * The collector — one link, one round, several axes.
 *
 * The rater arrives as a prop because identity comes from the link's token and
 * is resolved on the server. That deleted a fair amount of machinery: this used
 * to read a name out of localStorage through `useSyncExternalStore`, gate the
 * first render on being mounted so the picker did not flash at a returning
 * rater, and refetch the bootstrap once it knew who was asking.
 *
 * A round walks its axes in **sequential blocks**, never interleaved. Thirty
 * stamina questions, then thirty strength, then interior defense. Alternating
 * "who is stronger" with "who protects the rim" every four seconds is expensive
 * to think about, and the cost would come out of answer quality — a rater
 * should build a frame and stay inside it.
 */
export default function CompareApp({
  config,
  axes,
  round,
  rater,
  token,
}: {
  config: SportConfig;
  axes: CompareAxis[];
  round: AxisBootstrap[];
  rater: Rater;
  token: string;
}) {
  // Per-axis answered sets, seeded from the server render so a returning rater
  // resumes mid-round rather than starting the block again.
  const [answered, setAnswered] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(round.map((r) => [r.axis, new Set(r.answered)])),
  );
  const [seen, setSeen] = useState<Record<string, Record<string, number>>>(() =>
    Object.fromEntries(round.map((r) => [r.axis, r.seen])),
  );

  // One id per sitting, so a rushed run-through can be identified and dropped
  // without discarding that person's earlier, more considered answers. Created
  // on the first answer, which is the first moment it can matter.
  const sessionRef = useRef<string | null>(null);

  const pool: ComparePlayer[] = round[0].pool;
  const targets = useMemo(
    () => blockTargets(axes.length, pool.length),
    [axes.length, pool.length],
  );

  useEffect(() => {
    rememberToken(token);
  }, [token]);

  const anchors = useMemo(() => anchorPairs(pool), [pool]);

  /*
   * Which block is live, and how far through the round we are.
   *
   * A block is finished when its own target is met. Progress is reported for
   * the *round*, not the block: someone should see "62 of 80" once, not
   * "2 of 27" three separate times, because the round is what they agreed to.
   */
  const counts = axes.map((a) => answered[a.key]?.size ?? 0);
  const total = counts.reduce((sum, n) => sum + n, 0);
  const target = targets.reduce((sum, n) => sum + n, 0);
  const blockIndex = axes.findIndex((a, i) => counts[i] < targets[i]);
  const axis = blockIndex === -1 ? null : axes[blockIndex];

  // Per-axis pools: the estimate steering pair choice is that axis's own
  // number, so a stamina block asks about stamina neighbours.
  const axisPool = axis
    ? (round.find((r) => r.axis === axis.key)?.pool ?? pool)
    : pool;

  const seed = useMemo(
    () => seedFor(rater.id, total),
    [rater.id, total],
  );

  const pair: Pair | null = useMemo(() => {
    if (!axis) return null;
    return nextPair({
      pool: axisPool,
      raterId: rater.id,
      answered: answered[axis.key] ?? new Set(),
      seen: seen[axis.key] ?? {},
      seed,
      anchors,
    });
  }, [axis, axisPool, rater.id, answered, seen, seed, anchors]);

  function answer(winnerId: string | null) {
    if (!pair || !axis) return;
    sessionRef.current ??= Math.random().toString(36).slice(2, 10);

    const key = pairKey(pair.left.id, pair.right.id);
    const axisKey = axis.key;

    // Recorded locally first and awaited nowhere: at four seconds a question,
    // a network round trip between two names is the whole interaction.
    setAnswered((prev) => ({
      ...prev,
      [axisKey]: new Set(prev[axisKey]).add(key),
    }));
    setSeen((prev) => ({
      ...prev,
      [axisKey]: {
        ...prev[axisKey],
        [pair.left.id]: (prev[axisKey]?.[pair.left.id] ?? 0) + 1,
        [pair.right.id]: (prev[axisKey]?.[pair.right.id] ?? 0) + 1,
      },
    }));

    void submitComparison({
      sport: config.id,
      axis: axisKey,
      raterId: rater.id,
      sessionId: sessionRef.current,
      leftId: pair.left.id,
      rightId: pair.right.id,
      winnerId,
    }).catch(() => {
      // A dropped answer is a lost data point, not a broken session. The pair
      // is already marked answered locally, so the rater is not asked twice
      // and the flow does not stall on a bad connection.
    });
  }

  const done = axis === null || pair === null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-16 pt-6 lg:max-w-xl lg:px-8 lg:pt-10">
      <SportShards accent={config.accent} veil={0.3} />

      <header className="mb-8">
        <Link
          href={`/${config.id}`}
          className="text-sm text-ink-soft transition hover:text-ink"
        >
          ← {config.label}
        </Link>
        <h1 className="metal mt-3 text-2xl leading-none">
          {axis ? axis.heading : "That's the round."}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {axis
            ? `${axis.question} Go with your gut — there's no wrong answer, and nobody sees your picks individually.`
            : "Thanks — that's everything we needed."}
        </p>
      </header>

      {done || !axis ? (
        <Finished count={total} config={config} />
      ) : (
        <>
          <Progress
            count={total}
            target={target}
            block={blockIndex + 1}
            blocks={axes.length}
            label={axis.label}
          />
          <div className="mt-6 grid gap-3">
            <Choice player={pair.left} onPick={() => answer(pair.left.id)} />
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="eyebrow">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <Choice player={pair.right} onPick={() => answer(pair.right.id)} />
          </div>
          <button
            type="button"
            onClick={() => answer(null)}
            className="mx-auto mt-6 rounded-lg px-4 py-2 text-sm text-ink-soft underline decoration-dotted underline-offset-4 transition hover:text-ink"
          >
            Too close to call
          </button>
          <p className="mt-8 text-center text-xs leading-relaxed text-ink-soft">
            Rating as <span className="font-semibold text-ink">{rater.name}</span>.
            You&apos;ll never be asked about yourself.
          </p>
        </>
      )}
    </main>
  );
}

/**
 * Names only, and never a rating.
 *
 * Showing the current numbers would anchor the answer to the opinion this page
 * exists to check, which is the one way to make the whole exercise worthless.
 */
function Choice({
  player,
  onPick,
}: {
  player: ComparePlayer;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="w-full rounded-2xl border border-line bg-surface px-5 py-7 text-center text-xl font-semibold text-foreground shadow-[var(--shadow-card)] transition hover:border-accent hover:bg-raised active:translate-y-px"
    >
      {player.name}
    </button>
  );
}

function Progress({
  count,
  target,
  block,
  blocks,
  label,
}: {
  count: number;
  target: number;
  block: number;
  blocks: number;
  label: string;
}) {
  const pct = Math.min(100, (count / target) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">
          {count} of {target}
        </span>
        <span className="text-xs text-ink-soft">{remaining(count, target)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Which question is being asked now. A rater who does not notice the
          question changed answers the next block as if it were the last one. */}
      {blocks > 1 && (
        <p className="mt-2 text-xs text-ink-soft">
          Part {block} of {blocks} — <span className="font-semibold text-ink">{label}</span>
        </p>
      )}
    </div>
  );
}

/** Four seconds a question, rounded up, so nobody is promised a minute at 55 left. */
function remaining(count: number, target: number): string {
  const left = Math.max(0, target - count);
  const minutes = Math.ceil((left * 4) / 60);
  if (left === 0) return "done";
  return minutes <= 1 ? "under a minute left" : `about ${minutes} min left`;
}

/**
 * The end of the round, and it is an end.
 *
 * There is deliberately no "keep going". The old single-axis flow offered +20
 * and two of five raters took it, which was a good sign — but a round divides
 * one fixed budget between its axes, and letting an eager rater pile extra
 * answers onto whichever block they happened to be in would skew the very
 * comparison the split exists to make. Every rater contributes the same shape.
 */
function Finished({ count, config }: { count: number; config: SportConfig }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
      <p className="text-lg font-semibold text-foreground">
        That&apos;s the set — thank you.
      </p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
        {count} answers in. They get pooled with everyone else&apos;s, so no
        single person&apos;s opinion decides a rating.
      </p>
      <Link
        href={`/${config.id}`}
        className="mt-5 inline-block rounded-xl border border-line bg-surface px-4 py-3 text-sm text-foreground transition hover:border-line-strong hover:bg-sunken"
      >
        Back to {config.label}
      </Link>
    </div>
  );
}
