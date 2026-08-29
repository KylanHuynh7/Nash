"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { submitComp, submitComparison, submitTicks } from "@/app/actions";
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
import { NBA_COMPS } from "@/lib/nba";

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
  /*
   * The round's size comes from the WIDEST pool in it, never from block one.
   *
   * Block one is a pool-restricted ranking with a frozen nine-name slate, so
   * reading the roster size off it told the comp block there were eight people
   * to comp instead of sixteen. The share page already learned this and says
   * so; this is the same trap one component over.
   */
  const widestPool = Math.max(...round.map((r) => r.pool.length));
  const targets = useMemo(
    () => blockTargets(axes, widestPool),
    [axes, widestPool],
  );

  useEffect(() => {
    rememberToken(token);
  }, [token]);

  /*
   * Blocks the rater has been shown the handover screen for, this sitting.
   *
   * Victor answered a whole strength block as though it were still the stamina
   * one, and all 27 answers had to be thrown away. The inline "Part 2 of 3 —
   * Strength" label was not enough: it is small, it is above the fold, and
   * somebody in a rhythm of tapping names is not reading it. A change of
   * question now costs a deliberate tap.
   */
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

  /** Boxes currently on, per tick axis, restored from any earlier sitting. */
  const [ticked, setTicked] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(
      round.filter((r) => r.ticked).map((r) => [r.axis, new Set(r.ticked)]),
    ),
  );

  /** Comps already given, by subject id, restored from any earlier sitting. */
  const [given, setGiven] = useState<Record<string, string | null>>(() =>
    Object.assign({}, ...round.map((r) => r.comps ?? {})),
  );

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

  /*
   * What is actually LEFT, for the intro card.
   *
   * The card used to say "7 short parts, about 5 minutes" to everybody,
   * including a returning rater with 80 of 84 already answered and four
   * twenty-second passes to go. Overstating the remaining work to somebody who
   * has nearly finished is the same mistake as understating it: it is the
   * moment a session gets put down. Counted from the blocks that are actually
   * incomplete, at roughly four seconds a comparison and twenty a tick pass.
   */
  const partsLeft = axes.filter((_, i) => counts[i] < targets[i]).length;
  const secondsLeft = axes.reduce((sum, a, i) => {
    const left = Math.max(0, targets[i] - counts[i]);
    if (a.mode === "tick") return sum + left * 20;
    // A comp takes longer than a pairwise tap: you have to think of a name.
    if (a.mode === "comp") return sum + left * 6;
    return sum + left * 4;
  }, 0);

  const seed = useMemo(() => seedFor(rater.id, total), [rater.id, total]);

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

  // A tick block has no pair, so pairlessness only ends the round for a
  // comparative one.
  /*
   * Submit one whole tick pass.
   *
   * Every subject is sent with its state, not just the ticked ones, so that a
   * pass where nobody was ticked is stored as a real answer. An attribute that
   * comes back with zero ticks from everybody is a constant, which is how
   * dunking and `throwing` were caught — but only if the empty pass is
   * recorded rather than looking like an unopened block.
   */
  /*
   * Record one comp and move to the next subject.
   *
   * Saved per subject rather than as one pass, because a comp block is sixteen
   * questions and losing all of them to a closed tab is how a block gets
   * abandoned. `null` is a real answer - "no comp in mind" - so it is stored
   * and counted, not skipped.
   */
  function pickComp(subjectId: string, comp: string | null) {
    if (!axis || axis.mode !== "comp") return;
    sessionRef.current ??= Math.random().toString(36).slice(2, 10);
    const axisKey = axis.key;

    setGiven((prev) => ({ ...prev, [subjectId]: comp }));
    setAnswered((prev) => ({
      ...prev,
      [axisKey]: new Set(prev[axisKey]).add(subjectId),
    }));

    void submitComp({
      sport: config.id,
      raterId: rater.id,
      sessionId: sessionRef.current,
      subjectId,
      comp,
    }).catch(() => {
      // Same trade as a dropped comparison: a lost answer, not a stalled
      // session.
    });
  }

  function submitTickPass() {
    if (!axis || axis.mode !== "tick") return;
    sessionRef.current ??= Math.random().toString(36).slice(2, 10);
    const axisKey = axis.key;
    const on = ticked[axisKey] ?? new Set<string>();
    const subjects = axisPool
      .filter((p) => p.id !== rater.id)
      .map((p) => ({ id: p.id, ticked: on.has(p.id) }));

    setAnswered((prev) => ({
      ...prev,
      [axisKey]: new Set(prev[axisKey]).add("tick"),
    }));

    void submitTicks({
      sport: config.id,
      axis: axisKey,
      raterId: rater.id,
      sessionId: sessionRef.current,
      subjects,
    }).catch(() => {
      // Same trade as a dropped comparison: a lost pass is a lost data point,
      // not a stalled session.
    });
  }

  const done = axis === null || (axis.mode !== "tick" && pair === null);

  /*
   * Shown before a block nobody has answered yet. Only when the count is zero,
   * so a rater who stopped halfway through stamina and came back is returned to
   * their questions rather than made to dismiss a screen they have seen. For
   * the first block it doubles as the round's introduction.
   */
  const introducing =
    !done &&
    axis !== null &&
    (answered[axis.key]?.size ?? 0) === 0 &&
    !acknowledged.has(axis.key);

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
          {!axis
            ? "That's the round."
            : introducing
              ? "Who's better?"
              : axis.heading}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {!axis
            ? "Thanks — that's everything we needed."
            : introducing
              ? "Go with your gut — there's no wrong answer, and nobody sees your picks individually."
              : axis.question}
        </p>
      </header>

      {done || !axis ? (
        <Finished count={total} config={config} />
      ) : introducing ? (
        <BlockIntro
          axis={axis}
          index={blockIndex}
          count={axes.length}
          previous={blockIndex > 0 ? axes[blockIndex - 1] : null}
          questions={targets[blockIndex]}
          partsLeft={partsLeft}
          secondsLeft={secondsLeft}
          onStart={() => setAcknowledged((prev) => new Set(prev).add(axis.key))}
        />
      ) : axis.mode === "comp" ? (
        <>
          <Progress
            count={total}
            target={target}
            block={blockIndex + 1}
            blocks={axes.length}
            label={axis.label}
            secondsLeft={secondsLeft}
          />
          <CompBlock
            subjects={axisPool.filter(
              (p) => p.id !== rater.id && !(p.id in given),
            )}
            prompt={axis.prompt}
            onPick={pickComp}
          />
          <p className="mt-8 text-center text-xs leading-relaxed text-ink-soft">
            Rating as{" "}
            <span className="font-semibold text-ink">{rater.name}</span>.
            You&apos;ll never be asked about yourself.
          </p>
        </>
      ) : axis.mode === "tick" ? (
        <>
          <Progress
            count={total}
            target={target}
            block={blockIndex + 1}
            blocks={axes.length}
            label={axis.label}
            secondsLeft={secondsLeft}
          />
          <p className="mt-6 text-center text-sm font-semibold text-ink">
            {axis.prompt}
          </p>
          <TickBlock
            pool={axisPool.filter((p) => p.id !== rater.id)}
            ticked={ticked[axis.key] ?? EMPTY}
            onToggle={(id) =>
              setTicked((prev) => {
                const next = new Set(prev[axis.key] ?? []);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return { ...prev, [axis.key]: next };
              })
            }
            onSubmit={submitTickPass}
          />
          <p className="mt-8 text-center text-xs leading-relaxed text-ink-soft">
            Rating as{" "}
            <span className="font-semibold text-ink">{rater.name}</span>.
            You&apos;ll never be asked about yourself.
          </p>
        </>
      ) : pair ? (
        <>
          <Progress
            count={total}
            target={target}
            block={blockIndex + 1}
            blocks={axes.length}
            label={axis.label}
            secondsLeft={secondsLeft}
          />
          {/* The question, restated where the decision actually happens. The
              headline is at the top of the page and a rater a dozen answers in
              is only looking at the two buttons. */}
          <p className="mt-6 text-center text-sm font-semibold text-ink">
            {axis.prompt}
          </p>
          <div className="mt-3 grid gap-3">
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
            Rating as{" "}
            <span className="font-semibold text-ink">{rater.name}</span>.
            You&apos;ll never be asked about yourself.
          </p>
        </>
      ) : null}
    </main>
  );
}

/**
 * The handover between two blocks of a round.
 *
 * This exists because a round changed question underneath somebody and he did
 * not notice. Victor answered an entire strength block as though it were still
 * the stamina one — 27 good-faith answers to the wrong question, indetectable
 * in the data, and deleted. The inline part label was there the whole time.
 *
 * So the new question is the *only* thing on the screen, and continuing costs
 * a tap. The cost is one tap per block; the thing it prevents is a third of a
 * round being silently wrong.
 */
function BlockIntro({
  axis,
  index,
  count,
  previous,
  questions,
  partsLeft,
  secondsLeft,
  onStart,
}: {
  axis: CompareAxis;
  index: number;
  count: number;
  previous: CompareAxis | null;
  questions: number;
  /** Blocks still incomplete, including this one. */
  partsLeft: number;
  /** Rough seconds of work left across those blocks. */
  secondsLeft: number;
  onStart: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-[var(--shadow-card)]">
      {previous ? (
        <p className="text-sm font-semibold text-accent">
          {previous.label} complete ✓
        </p>
      ) : (
        <p className="eyebrow">
          {partsLeft} short part{partsLeft === 1 ? "" : "s"}, about{" "}
          {secondsLeft < 90
            ? "a minute"
            : `${Math.round(secondsLeft / 60)} minutes`}
        </p>
      )}

      <p className="eyebrow mt-4">
        Part {index + 1} of {count}
      </p>
      {/* The whole point of the screen: the question that is about to change,
          on its own, at a size that cannot be skimmed past.

          Not `.metal` — that is dark brushed steel, tuned for text sitting on
          the page's silver ground, and it goes nearly invisible on a dark card.
          Same trap as the amber sit-out badge in the bug list. */}
      <h2 className="mt-1 text-2xl font-semibold leading-tight text-foreground">
        {axis.heading}
      </h2>
      <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted">
        {axis.question}
      </p>

      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 active:translate-y-px"
      >
        {axis.mode === "tick"
          ? "Start"
          : previous
            // Verbatim, not lowercased: "the nba comp questions" is what
            // lowercasing an acronym label gets you. Block names read as
            // proper names everywhere else in this UI too.
            ? `Start the ${axis.label} questions`
            : "Start"}
      </button>
      <p className="mt-3 text-xs text-ink-soft">
        {axis.mode === "tick"
          ? "One quick pass through the roster"
          : `${questions} question${questions === 1 ? "" : "s"} in this part`}
      </p>
    </div>
  );
}

const EMPTY: ReadonlySet<string> = new Set();

/**
 * One pass over the whole roster: tick everyone who does the thing.
 *
 * The second collection shape in the app, and the reason the attribute tree
 * could grow to fifteen without asking anybody for twenty minutes of tapping.
 * A comparative block spends ~30 questions to rank seventeen people, which is
 * right when the calls are close and wrong when most of the roster is at the
 * floor. This asks the roster once, in about twenty seconds.
 *
 * Deliberately NOT a list of pair buttons: the whole saving is that the rater
 * reads seventeen names once and recalls a fact about each, rather than
 * re-deciding the same person against a dozen opponents.
 *
 * Names only, like `Choice` — showing the current rating would anchor the
 * answer to the opinion this page exists to check.
 */
/**
 * One subject at a time: "who does he play like?"
 *
 * A curated list rather than a text box, because five raters answering freely
 * about seventeen people produce five different names each and no modal answer
 * — the feature would collect singletons and never be able to say what the
 * group thinks. The filter is what keeps a sixty-name list usable on a phone:
 * anyone who already has a name in mind types three letters and taps.
 *
 * "Someone else" and "No idea" both exist because forcing a pick from the list
 * would manufacture agreement that is not there. A skip is stored as a real
 * answer, not left as a gap.
 */
function CompBlock({
  subjects,
  prompt,
  onPick,
}: {
  subjects: ComparePlayer[];
  prompt: string;
  onPick: (subjectId: string, comp: string | null) => void;
}) {
  const [filter, setFilter] = useState("");
  const [custom, setCustom] = useState("");
  const [free, setFree] = useState(false);

  const subject = subjects[0];

  // Cleared per subject, so the previous person's search does not narrow the
  // list for the next one.
  function advance(comp: string | null) {
    if (!subject) return;
    setFilter("");
    setCustom("");
    setFree(false);
    onPick(subject.id, comp);
  }

  if (!subject) return null;

  const needle = filter.trim().toLowerCase();
  const groups = NBA_COMPS.map((g) => ({
    label: g.label,
    players: g.players.filter((n) => n.toLowerCase().includes(needle)),
  })).filter((g) => g.players.length > 0);

  return (
    <div className="mt-3">
      <p className="text-center text-sm text-ink-soft">{prompt}</p>
      <p className="mt-1 text-center text-2xl font-bold text-ink">
        {subject.name}
      </p>

      {free ? (
        <div className="mt-5">
          <input
            autoFocus
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Type a name"
            aria-label="Someone else"
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-foreground outline-none focus:border-accent"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFree(false)}
              className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink-soft"
            >
              Back to the list
            </button>
            <button
              type="button"
              disabled={custom.trim() === ""}
              onClick={() => advance(custom)}
              className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              That&apos;s him
            </button>
          </div>
        </div>
      ) : (
        <>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search"
            aria-label="Search NBA players"
            className="mt-4 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent"
          />

          <div className="mt-3 max-h-[46vh] overflow-y-auto pr-0.5">
            {groups.map((group) => (
              <section key={group.label} className="mb-3">
                <h3 className="eyebrow mb-1.5">{group.label}</h3>
                <ul className="grid gap-1.5">
                  {group.players.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => advance(name)}
                        className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-sm font-semibold text-foreground transition hover:border-accent hover:bg-raised active:translate-y-px"
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {groups.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-soft">
                Nobody by that name on the list.
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFree(true)}
              className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-accent"
            >
              Someone else
            </button>
            {/*
              A skip is an answer. Storing it is what keeps "went through him
              and had nobody in mind" tellable from "never got that far".
            */}
            <button
              type="button"
              onClick={() => advance(null)}
              className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-accent"
            >
              No idea — skip
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function TickBlock({
  pool,
  ticked,
  onToggle,
  onSubmit,
}: {
  pool: ComparePlayer[];
  ticked: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-3">
      <ul className="grid gap-2">
        {pool.map((p) => {
          const on = ticked.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(p.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base font-semibold transition active:translate-y-px ${
                  on
                    ? "border-accent bg-raised text-foreground"
                    : "border-line bg-surface text-ink-soft hover:border-accent/50"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                    on
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-transparent"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                {p.name}
              </button>
            </li>
          );
        })}
      </ul>

      {/*
        Always enabled, including with nothing ticked. An empty pass is a real
        answer — it says this attribute may be a constant — and disabling the
        button would quietly convert that finding into an abandoned block.
      */}
      <button
        type="button"
        onClick={onSubmit}
        className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 active:translate-y-px"
      >
        {ticked.size === 0
          ? "Nobody — next part"
          : `Done — ${ticked.size} ticked`}
      </button>
    </div>
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
  secondsLeft,
}: {
  count: number;
  target: number;
  block: number;
  blocks: number;
  label: string;
  /** Mode-aware, from the caller - a comp costs more than a pairwise tap. */
  secondsLeft: number;
}) {
  const pct = Math.min(100, (count / target) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">
          {count} of {target}
        </span>
        <span className="text-xs text-ink-soft">
          {remaining(secondsLeft, Math.max(0, target - count))}
        </span>
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
          Part {block} of {blocks} —{" "}
          <span className="font-semibold text-ink">{label}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Rounded up, so nobody is promised a minute at 55 questions left.
 *
 * Takes the seconds rather than recomputing them. It used to assume four
 * seconds for every remaining question in the round, which was true while every
 * block was pairwise and quietly wrong once they were not: a comp block at six
 * seconds a question read as "under a minute" on ninety seconds of work. The
 * caller already knows what each block costs; two estimates that disagree is
 * one estimate too many.
 */
function remaining(secondsLeft: number, left: number): string {
  if (left === 0) return "done";
  const minutes = Math.ceil(secondsLeft / 60);
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
