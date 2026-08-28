"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getCompareBootstrap, submitComparison } from "@/app/actions";
import type { CompareBootstrap } from "@/app/actions";
import { Button } from "@/components/ui";
import SportShards from "@/components/SportShards";
import {
  SESSION_TARGET,
  anchorPairs,
  availablePairs,
  nextPair,
  pairKey,
  seedFor,
  type ComparePlayer,
  type Pair,
} from "@/lib/compare";
import type { SportConfig } from "@/lib/sports";

const RATER_STORAGE_KEY = "nash:compare:rater";

/* ------------------------------------------------------------------ *
 * Who is rating, read from localStorage.
 *
 * localStorage is an external store, so it is subscribed to rather than copied
 * into state inside an effect. Copying it in an effect renders once with the
 * wrong answer and then again with the right one, and on this page the wrong
 * answer is the name picker - a returning rater would see it flash before being
 * sent back to their questions.
 * ------------------------------------------------------------------ */

const raterListeners = new Set<() => void>();

function subscribeRater(onChange: () => void) {
  raterListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    raterListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRater(): string | null {
  try {
    return window.localStorage.getItem(RATER_STORAGE_KEY);
  } catch {
    // Private windows throw on access. Picking a name again is a fine fallback.
    return null;
  }
}

function writeRater(id: string) {
  try {
    window.localStorage.setItem(RATER_STORAGE_KEY, id);
  } catch {
    // Not being able to remember the choice is no reason to block rating.
  }
  for (const listener of raterListeners) listener();
}

/** The server has no localStorage, so it always renders the picker. */
const noRater = () => null;
const alwaysFalse = () => false;
const alwaysTrue = () => true;
const noSubscribe = () => () => {};

export default function CompareApp({
  config,
  bootstrap,
}: {
  config: SportConfig;
  bootstrap: CompareBootstrap;
}) {
  const mounted = useSyncExternalStore(noSubscribe, alwaysTrue, alwaysFalse);
  const raterId = useSyncExternalStore(subscribeRater, readRater, noRater);

  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [seen, setSeen] = useState<Record<string, number>>({});
  /** Raised by "keep going", so finishing the set is an offer and not a wall. */
  const [bonus, setBonus] = useState(0);

  // One id per sitting, so a rushed run-through can be identified and dropped
  // without discarding that person's earlier, more considered answers. Created
  // on the first answer, which is the first moment it can matter.
  const sessionRef = useRef<string | null>(null);

  const pool: ComparePlayer[] = bootstrap.pool;

  // Which pairs this rater has already answered, so a sitting resumes instead
  // of asking the same questions again. Only this needs the network.
  useEffect(() => {
    if (!raterId) return;
    let cancelled = false;
    void getCompareBootstrap(config.id, raterId).then((fresh) => {
      if (cancelled) return;
      setAnswered(new Set(fresh.answered));
      setSeen(fresh.seen);
    });
    return () => {
      cancelled = true;
    };
  }, [raterId, config.id]);

  const anchors = useMemo(() => anchorPairs(pool), [pool]);
  // Progress counts every answer this rater has ever given, not this sitting's.
  // Someone who answered thirty last week and reopens the page has done half
  // the work, and being shown "0 of 60" tells them they have done none of it.
  const total = answered.size;
  // Never promise more questions than exist. A twelve-man roster leaves a rater
  // 55 pairs, and a bar counting toward 60 would never fill.
  const target = Math.min(
    SESSION_TARGET + bonus,
    availablePairs(pool.length, Boolean(raterId)),
  );

  const seed = useMemo(() => seedFor(raterId, total), [raterId, total]);

  const pair: Pair | null = useMemo(() => {
    if (!raterId) return null;
    return nextPair({ pool, raterId, answered, seen, seed, anchors });
  }, [pool, raterId, answered, seen, seed, anchors]);

  function chooseRater(id: string) {
    writeRater(id);
  }

  function answer(winnerId: string | null) {
    if (!pair || !raterId) return;
    sessionRef.current ??= Math.random().toString(36).slice(2, 10);

    const key = pairKey(pair.left.id, pair.right.id);

    // Recorded locally first and awaited nowhere: at four seconds a question,
    // a network round trip between two names is the whole interaction.
    setAnswered((prev) => new Set(prev).add(key));
    setSeen((prev) => ({
      ...prev,
      [pair.left.id]: (prev[pair.left.id] ?? 0) + 1,
      [pair.right.id]: (prev[pair.right.id] ?? 0) + 1,
    }));

    void submitComparison({
      sport: config.id,
      raterId,
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

  const rater = pool.find((p) => p.id === raterId) ?? null;
  const done = total >= target;

  // Rendering the picker before localStorage is readable would flash it at a
  // returning rater on every visit.
  if (!mounted) return null;

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
        <h1 className="metal mt-3 text-2xl leading-none">Who&apos;s better?</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {rater
            ? "Pick who you'd rather have on your team. Go with your gut — there's no wrong answer, and nobody sees your picks individually."
            : "The ratings on this site come from one person. This fixes that. Pick your name to start."}
        </p>
      </header>

      {!rater ? (
        <RaterPicker pool={pool} onPick={chooseRater} />
      ) : done ? (
        <Finished
          count={total}
          config={config}
          onMore={() => setBonus((b) => b + 20)}
        />
      ) : pair ? (
        <>
          <Progress count={total} target={target} />
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
      ) : (
        <Finished count={total} config={config} onMore={null} />
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

function Progress({ count, target }: { count: number; target: number }) {
  const pct = Math.min(100, (count / target) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">
          {count} of {target}
        </span>
        <span className="text-xs text-ink-soft">
          {remaining(count, target)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
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

function RaterPicker({
  pool,
  onPick,
}: {
  pool: ComparePlayer[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {pool.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.id)}
          className="rounded-xl border border-line bg-surface px-3 py-4 font-semibold text-foreground shadow-[var(--shadow-card)] transition hover:border-accent hover:bg-raised active:translate-y-px"
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

function Finished({
  count,
  config,
  onMore,
}: {
  count: number;
  config: SportConfig;
  onMore: (() => void) | null;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
      <p className="text-lg font-semibold text-foreground">
        {onMore ? "That's the set — thank you." : "You've answered every pair."}
      </p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
        {count} answers in. They get pooled with everyone else&apos;s, so no
        single person&apos;s opinion decides a rating.
      </p>
      <div className="mt-5 flex flex-col gap-2.5">
        {onMore && (
          <Button onClick={onMore}>Keep going</Button>
        )}
        <Link
          href={`/${config.id}`}
          className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-foreground transition hover:border-line-strong hover:bg-sunken"
        >
          Back to {config.label}
        </Link>
      </div>
    </div>
  );
}
