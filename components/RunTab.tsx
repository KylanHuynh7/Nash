"use client";

import { useMemo, useState } from "react";
import { saveRun } from "@/app/actions";
import { Button, EmptyState, ratingTone, teamColor } from "@/components/ui";
import TeamBoard, {
  boardSpread,
  teamAverage,
  type Board,
} from "@/components/TeamBoard";
import {
  balanceTeams,
  type BalanceResult,
  type Constraint,
} from "@/lib/balance";
import type { SportConfig } from "@/lib/sports";
import type { RosterEntry } from "@/app/actions";

type Rule = Constraint & { kind: "together" | "apart" };

/** Stable pseudo-random ordering for a given id and seed. */
function jitter(id: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h / 0xffffffff;
}

export default function RunTab({
  config,
  roster,
  onAddPlayer,
}: {
  config: SportConfig;
  roster: RosterEntry[];
  onAddPlayer: () => void;
}) {
  /** Everyone who showed up tonight. */
  const [present, setPresent] = useState<Set<string>>(new Set());
  /** Of those, the ones taking the floor this game. The rest wait. */
  const [playing, setPlaying] = useState<Set<string>>(new Set());
  const teamCount = 2;
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [seed, setSeed] = useState(1);
  const [rules, setRules] = useState<Rule[]>([]);
  /** How many times each player has sat this session, so rotation stays fair. */
  const [sitOutCounts, setSitOutCounts] = useState<Record<string, number>>({});
  const [sitting, setSitting] = useState<RosterEntry[]>([]);
  /** Editable copy of the generated teams; drag-and-drop writes here. */
  const [board, setBoard] = useState<Board | null>(null);
  const [edited, setEdited] = useState(false);
  const [view, setView] = useState<"list" | "court">("court");
  /** Winner-stays-on: which side is holding the court, and for how long. */
  const [streak, setStreak] = useState<{ team: number; count: number } | null>(
    null,
  );
  const [showRules, setShowRules] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "saving" | "copied">(
    "idle",
  );

  const here = useMemo(
    () => roster.filter((p) => present.has(p.id)),
    [roster, present],
  );

  const onCourt = useMemo(
    () => here.filter((p) => playing.has(p.id)),
    [here, playing],
  );

  const perTeam =
    onCourt.length >= teamCount ? Math.floor(onCourt.length / teamCount) : 0;
  const sitCount = here.length - onCourt.length;
  /** A full game, or as close as the turnout allows. */
  const courtCap = Math.min(
    config.sideSize * teamCount,
    here.length - (here.length % teamCount),
  );

  const criticalLabel = useMemo(() => {
    const key = config.criticalPosition;
    return key
      ? (config.positions.find((p) => p.key === key)?.full.toLowerCase() ?? key)
      : "";
  }, [config]);

  const liveSpread = useMemo(() => (board ? boardSpread(board) : 0), [board]);

  const shortCritical = useMemo(() => {
    const key = config.criticalPosition;
    if (!key || !board) return 0;
    return board.teams.filter(
      (team) => team.length > 0 && !team.some((p) => p.position === key),
    ).length;
  }, [config, board]);

  const positionLabel = useMemo(
    () => new Map(config.positions.map((p) => [p.key, p.label])),
    [config],
  );

  function clearResult() {
    setResult(null);
    setBoard(null);
    setStreak(null);
    setShareState("idle");
  }

  function togglePresent(id: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Someone who went home can't still be on the floor.
      setPlaying((p) => new Set([...p].filter((x) => next.has(x))));
      return next;
    });
    clearResult();
  }

  function togglePlaying(id: string) {
    setPlaying((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    clearResult();
  }

  /** Fills the floor with whoever has sat the most, so waiting evens out. */
  function autoPick() {
    const ordered = [...here].sort(
      (a, b) =>
        (sitOutCounts[b.id] ?? 0) - (sitOutCounts[a.id] ?? 0) ||
        jitter(a.id, seed) - jitter(b.id, seed),
    );
    setPlaying(new Set(ordered.slice(0, courtCap).map((p) => p.id)));
    clearResult();
  }

  function generate(nextSeed: number) {
    // Who plays is already decided upstairs; anyone here but not on the floor
    // is waiting, and their wait count grows so auto-pick can even it out.
    const benched = here.filter((p) => !playing.has(p.id));

    if (benched.length > 0) {
      setSitOutCounts((prev) => {
        const next = { ...prev };
        for (const p of benched) next[p.id] = (next[p.id] ?? 0) + 1;
        return next;
      });
    }
    setSitting(benched);

    // Rules only bind players who are actually on the floor.
    const active = rules.filter((r) => playing.has(r.a) && playing.has(r.b));

    const next = balanceTeams(onCourt, {
      teamCount,
      seed: nextSeed,
      together: active.filter((r) => r.kind === "together"),
      apart: active.filter((r) => r.kind === "apart"),
    });

    setResult(next);
    setBoard({
      teams: next.teams.map((t) => t.players),
      bench: benched,
      pinned: {},
    });
    setEdited(false);
    setSeed(nextSeed);
    setShareState("idle");
  }

  function recordWin(winnerIndex: number) {
    if (!board) return;

    const winners = board.teams[winnerIndex];
    const losers = board.teams[1 - winnerIndex] ?? [];
    const wait = (p: { id: string }) => sitOutCounts[p.id] ?? 0;

    // Losers line up behind everyone already waiting.
    const queue = [...board.bench, ...losers].sort(
      (a, b) => wait(b) - wait(a) || jitter(a.id, seed) - jitter(b.id, seed),
    );
    const challengers = queue.slice(0, winners.length);
    const waiting = queue.slice(winners.length);

    if (waiting.length > 0) {
      setSitOutCounts((prev) => {
        const next = { ...prev };
        for (const p of waiting) next[p.id] = (next[p.id] ?? 0) + 1;
        return next;
      });
    }

    const teams = [...board.teams];
    teams[winnerIndex] = winners;
    teams[1 - winnerIndex] = challengers;

    setBoard({ teams, bench: waiting, pinned: {} });
    setSitting(roster.filter((p) => waiting.some((w) => w.id === p.id)));
    setPlaying(new Set([...winners, ...challengers].map((p) => p.id)));

    // The new matchup is the baseline now, so undo has nothing stale to revert to.
    setResult({
      teams: teams.map((players) => ({
        players,
        total: players.reduce((sum, p) => sum + p.overall, 0),
        average: teamAverage(players),
      })),
      spread: 0,
      unmet: [],
    });
    setEdited(false);
    setShareState("idle");

    setStreak((prev) =>
      prev && prev.team === winnerIndex
        ? { team: winnerIndex, count: prev.count + 1 }
        : { team: winnerIndex, count: 1 },
    );
  }

  async function share() {
    if (!board) return;
    setShareState("saving");
    try {
      const { id } = await saveRun({
        sport: config.id,
        teams: board.teams.map((players) => ({ players })),
        spread: liveSpread,
      });
      const url = `${window.location.origin}/run/${id}`;
      if (navigator.share) {
        await navigator.share({ title: `${config.label} teams`, url });
        setShareState("idle");
      } else {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
      }
    } catch {
      setShareState("idle");
    }
  }

  if (roster.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="No one on the roster yet"
          body={`Add your regulars once with their ${config.label.toLowerCase()} ratings. After that, running it back is three taps.`}
        />
        <Button onClick={onAddPlayer} className="w-full">
          Add the first player
        </Button>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="space-y-6">
        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Who showed up
            </h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-mono tabular-nums text-muted">
                {here.length}/{roster.length}
              </span>
              <button
                onClick={() => {
                  const all = here.length === roster.length;
                  setPresent(
                    all ? new Set() : new Set(roster.map((p) => p.id)),
                  );
                  if (all) setPlaying(new Set());
                  clearResult();
                }}
                className="text-accent hover:underline"
              >
                {here.length === roster.length ? "Clear" : "All"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {roster.map((p) => {
              const on = present.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => togglePresent(p.id)}
                  aria-pressed={on}
                  // Attendance is a filter, not a selection: most people are
                  // usually here, so the present look normal and the absent
                  // recede. Painting every attendee accent-solid turns the
                  // ordinary case into a wall of colour.
                  className={`flex items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-1.5 text-sm transition ${
                    on
                      ? "border-accent-line bg-surface text-foreground shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]"
                      : "border-line bg-transparent text-muted opacity-70 hover:opacity-100"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full transition ${on ? "bg-accent" : "bg-transparent ring-1 ring-line-strong"}`}
                  />
                  <span className={on ? "font-semibold" : ""}>{p.name}</span>
                  <span
                    className={`figure rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                      on ? ratingTone(p.overall) : "text-muted"
                    }`}
                  >
                    {p.overall}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {here.length >= 2 && (
          <section>
            <div className="mb-2.5 flex items-baseline justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
                On the {config.surface}
              </h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-mono tabular-nums text-muted">
                  {onCourt.length}/{here.length}
                </span>
                <button
                  onClick={autoPick}
                  className="text-accent hover:underline"
                >
                  Auto-pick {courtCap}
                </button>
                {onCourt.length > 0 && (
                  <button
                    onClick={() => {
                      setPlaying(new Set());
                      clearResult();
                    }}
                    className="text-muted hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {onCourt.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong bg-surface/50 px-3 py-3 text-center text-xs text-muted">
                Pick who&apos;s playing this game, or auto-pick to give the
                longest-waiting {courtCap} the {config.surface}.
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-2">
              {here.map((p) => {
                const on = playing.has(p.id);
                const waited = sitOutCounts[p.id] ?? 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlaying(p.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-2 rounded-full border py-2 pl-3 pr-2.5 text-sm transition ${
                      on
                        ? "border-accent bg-accent text-white shadow-sm"
                        : "border-line bg-surface text-muted shadow-sm hover:border-line-strong hover:text-foreground"
                    }`}
                  >
                    <span className={on ? "font-medium" : ""}>{p.name}</span>
                    {!on && waited > 0 && (
                      <span
                        title={`Sat out ${waited} game${waited > 1 ? "s" : ""}`}
                        className="rounded bg-amber-100 px-1 font-mono text-[10px] font-semibold text-amber-300"
                      >
                        {waited}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
          <div>
            <p className="text-sm font-medium">
              {perTeam > 0
                ? `${perTeam}v${perTeam}`
                : "Nobody on the court yet"}
            </p>
            <p className="text-xs text-muted">
              {here.length < 2
                ? "Tap who showed up"
                : onCourt.length < 2
                  ? `${here.length} here — pick who's playing`
                  : sitCount > 0
                    ? `${sitCount} waiting${onCourt.length % 2 ? " · odd number on court" : ""}`
                    : "Everybody plays"}
            </p>
          </div>
          <span className="font-mono text-2xl tabular-nums text-muted">
            {onCourt.length}
          </span>
        </section>

        <section>
          <button
            onClick={() => setShowRules((v) => !v)}
            className="flex w-full items-center justify-between py-1 text-sm text-muted hover:text-foreground"
          >
            <span>Pairing rules{rules.length > 0 && ` · ${rules.length}`}</span>
            <span aria-hidden>{showRules ? "−" : "+"}</span>
          </button>

          {showRules && (
            <div className="mt-2 space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
              {rules.length === 0 && (
                <p className="px-1 py-1 text-xs leading-relaxed text-muted">
                  Force two people onto the same team, or keep them apart. Rules
                  only apply when both players are marked here.
                </p>
              )}
              {rules.map((rule, i) => {
                const a = roster.find((p) => p.id === rule.a);
                const b = roster.find((p) => p.id === rule.b);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-sm"
                  >
                    <span className="flex-1">
                      {a?.name}{" "}
                      <span className="text-muted">
                        {rule.kind === "together" ? "with" : "vs"}
                      </span>{" "}
                      {b?.name}
                    </span>
                    <button
                      onClick={() => {
                        setRules((prev) => prev.filter((_, idx) => idx !== i));
                        setResult(null);
                      }}
                      aria-label="Remove rule"
                      className="px-1 text-muted hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <RuleBuilder
                roster={roster}
                onAdd={(rule) => {
                  setRules((prev) => [...prev, rule]);
                  setResult(null);
                  setBoard(null);
                }}
              />
            </div>
          )}
        </section>

        <Button
          onClick={() => generate(Math.floor(Math.random() * 1e9))}
          disabled={onCourt.length < teamCount}
          className="w-full py-4 text-base"
        >
          {result ? "Regenerate" : "Generate teams"}
        </Button>
      </div>

      <div className="mt-6 lg:mt-0">
        {!result && (
          <StageGuide
            surface={config.surface}
            stage={here.length < 2 ? 0 : onCourt.length < 2 ? 1 : 2}
            here={here.length}
            onCourt={onCourt.length}
            perTeam={perTeam}
          />
        )}

        {result && board && (
          <section className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">
                Spread{" "}
                <span
                  className={`font-mono tabular-nums ${liveSpread <= 1 ? "text-emerald-400" : liveSpread <= 3 ? "text-amber-400" : "text-rose-400"}`}
                >
                  {liveSpread.toFixed(1)}
                </span>
                {edited && (
                  <span className="ml-2 text-xs text-accent">edited</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex rounded-lg border border-line bg-sunken p-0.5">
                  {(["court", "list"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setView(mode)}
                      aria-pressed={view === mode}
                      className={`rounded-md px-2.5 py-1 text-xs capitalize transition ${
                        view === mode
                          ? "bg-surface font-semibold text-foreground shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {mode === "court" ? config.surface : mode}
                    </button>
                  ))}
                </div>
                {edited && (
                  <button
                    onClick={() => {
                      setBoard({
                        teams: result.teams.map((t) => t.players),
                        bench: sitting,
                        pinned: {},
                      });
                      setEdited(false);
                    }}
                    className="text-muted hover:text-foreground"
                  >
                    Undo edits
                  </button>
                )}
                <button
                  onClick={() => generate(seed + 1)}
                  className="text-accent hover:underline"
                >
                  Reshuffle
                </button>
              </div>
            </div>

            {shortCritical > 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {shortCritical} team{shortCritical > 1 ? "s have" : " has"} no{" "}
                {criticalLabel}. Mark someone else who can play it.
              </p>
            )}

            {result.unmet.length > 0 && !edited && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Couldn&apos;t satisfy {result.unmet.length} rule
                {result.unmet.length > 1 ? "s" : ""} with this group.
              </p>
            )}

            <TeamBoard
              board={board}
              config={config}
              view={view}
              positionLabel={positionLabel}
              onChange={(next) => {
                setBoard(next);
                setEdited(true);
              }}
            />

            <div className="rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
              <div className="mb-2 flex items-baseline justify-between px-0.5">
                <span className="text-sm font-medium">Who won?</span>
                {streak && streak.count > 1 && (
                  <span className="text-xs text-muted">
                    <span
                      className={`font-semibold ${teamColor(streak.team).chip.split(" ")[1]}`}
                    >
                      {teamColor(streak.team).label}
                    </span>{" "}
                    on {streak.count} straight
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {board.teams.map((team, i) => {
                  const color = teamColor(i);
                  return (
                    <button
                      key={i}
                      onClick={() => recordWin(i)}
                      disabled={team.length === 0}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition disabled:opacity-40 ${color.chip} hover:brightness-95 active:translate-y-px`}
                    >
                      <span
                        aria-hidden
                        className={`h-2 w-2 rounded-full ${color.dot}`}
                      />
                      {color.label} won
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 px-0.5 text-center text-[11px] text-muted">
                Winners hold the {config.surface}. Losers go to the back of the
                line and the longest waits come on.
              </p>
            </div>

            <p className="text-center text-xs text-muted">
              {view === "court"
                ? "Drag onto a spot to change position, or down to Next up. The team that's ahead owns the +."
                : "Drag anyone between teams or down to Next up — the spread updates as you go."}
            </p>

            <Button
              variant="ghost"
              onClick={share}
              className="w-full sm:max-w-xs"
            >
              {shareState === "saving"
                ? "Saving…"
                : shareState === "copied"
                  ? "Link copied ✓"
                  : "Share these teams"}
            </Button>
          </section>
        )}
      </div>
    </div>
  );
}

function RuleBuilder({
  roster,
  onAdd,
}: {
  roster: RosterEntry[];
  onAdd: (rule: Rule) => void;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [kind, setKind] = useState<"together" | "apart">("together");

  const select =
    "min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <select
        value={a}
        onChange={(e) => setA(e.target.value)}
        className={select}
      >
        <option value="">Player…</option>
        {roster.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() =>
          setKind((k) => (k === "together" ? "apart" : "together"))
        }
        className="rounded-lg border border-line bg-surface px-2.5 py-2 text-xs font-medium text-accent"
      >
        {kind === "together" ? "with" : "vs"}
      </button>
      <select
        value={b}
        onChange={(e) => setB(e.target.value)}
        className={select}
      >
        <option value="">Player…</option>
        {roster
          .filter((p) => p.id !== a)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </select>
      <Button
        variant="ghost"
        disabled={!a || !b || a === b}
        onClick={() => {
          onAdd({ a, b, kind });
          setA("");
          setB("");
        }}
        className="!px-3 !py-2"
      >
        Add
      </Button>
    </div>
  );
}

/**
 * Fills the second column before teams exist. It used to be an empty dashed
 * box taking up half a laptop screen; the three stages are the one thing worth
 * saying there, since the flow is the part of this app that needs explaining.
 */
function StageGuide({
  surface,
  stage,
  here,
  onCourt,
  perTeam,
}: {
  surface: string;
  stage: number;
  here: number;
  onCourt: number;
  perTeam: number;
}) {
  const steps = [
    {
      title: "Who showed up",
      body: "Tap everyone who turned out tonight.",
      done: `${here} here`,
    },
    {
      title: `On the ${surface}`,
      body: `Pick who's playing this game — or let Auto-pick give the ${surface} to whoever has waited longest.`,
      done: `${onCourt} playing`,
    },
    {
      title: "Generate",
      body: "Teams are built from the players on the floor, balanced on rating, size and position at once.",
      done: perTeam > 0 ? `${perTeam}v${perTeam} ready` : "",
    },
  ];

  return (
    <div className="hidden rounded-2xl border border-line bg-surface/70 p-6 shadow-[var(--shadow-card)] backdrop-blur-sm lg:block">
      <p className="eyebrow">How a run works</p>
      <ol className="mt-4 space-y-1">
        {steps.map((step, i) => {
          const active = i === stage;
          const complete = i < stage;
          return (
            <li
              key={step.title}
              className={`flex gap-3.5 rounded-xl px-3 py-3 transition ${
                active ? "bg-accent-wash ring-1 ring-accent-line" : ""
              }`}
            >
              <span
                aria-hidden
                className={`figure mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  complete
                    ? "bg-accent text-white"
                    : active
                      ? "bg-accent text-white"
                      : "bg-sunken text-muted"
                }`}
              >
                {complete ? "\u2713" : i + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span
                    className={`text-sm font-semibold ${active ? "text-accent-strong" : complete ? "text-foreground" : "text-muted"}`}
                  >
                    {step.title}
                  </span>
                  {step.done && (complete || active) && (
                    <span className="figure text-[11px] text-muted">
                      {step.done}
                    </span>
                  )}
                </span>
                {active && (
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {step.body}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
