"use client";

import { useMemo, useState } from "react";
import { saveRun } from "@/app/actions";
import { Button, EmptyState, Rating } from "@/components/ui";
import {
  balanceTeams,
  type BalanceResult,
  type Constraint,
} from "@/lib/balance";
import type { SportConfig } from "@/lib/sports";
import type { RosterEntry } from "@/app/actions";

type Rule = Constraint & { kind: "together" | "apart" };

export default function RunTab({
  config,
  roster,
  onAddPlayer,
}: {
  config: SportConfig;
  roster: RosterEntry[];
  onAddPlayer: () => void;
}) {
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [teamCount, setTeamCount] = useState(config.defaultTeams);
  const [result, setResult] = useState<BalanceResult | null>(null);
  const [seed, setSeed] = useState(1);
  const [rules, setRules] = useState<Rule[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "saving" | "copied">(
    "idle",
  );

  const here = useMemo(
    () => roster.filter((p) => present.has(p.id)),
    [roster, present],
  );

  const positionLabel = useMemo(
    () => new Map(config.positions.map((p) => [p.key, p.label])),
    [config],
  );

  function toggle(id: string) {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
    setShareState("idle");
  }

  function generate(nextSeed: number) {
    // Only apply rules whose players both actually showed up.
    const active = rules.filter((r) => present.has(r.a) && present.has(r.b));
    setResult(
      balanceTeams(here, {
        teamCount,
        seed: nextSeed,
        together: active.filter((r) => r.kind === "together"),
        apart: active.filter((r) => r.kind === "apart"),
      }),
    );
    setSeed(nextSeed);
    setShareState("idle");
  }

  async function share() {
    if (!result) return;
    setShareState("saving");
    try {
      const { id } = await saveRun({
        sport: config.id,
        teams: result.teams.map((t) => ({ players: t.players })),
        spread: result.spread,
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

  const maxTeams = Math.max(2, Math.min(4, here.length));

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="space-y-6">
        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Who&apos;s here
            </h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-mono tabular-nums text-muted">
                {here.length}/{roster.length}
              </span>
              <button
                onClick={() => {
                  setPresent(
                    here.length === roster.length
                      ? new Set()
                      : new Set(roster.map((p) => p.id)),
                  );
                  setResult(null);
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
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-full border py-2 pl-3 pr-2.5 text-sm transition ${
                    on
                      ? "border-accent bg-accent/15 text-foreground"
                      : "border-line bg-surface text-muted hover:border-neutral-600"
                  }`}
                >
                  <span className={on ? "font-medium" : ""}>{p.name}</span>
                  <span
                    className={`font-mono text-xs tabular-nums ${on ? "text-accent" : "text-neutral-600"}`}
                  >
                    {p.overall}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-medium">Teams</p>
            <p className="text-xs text-muted">
              {here.length >= 2
                ? `${Math.floor(here.length / teamCount)}${here.length % teamCount ? "–" + Math.ceil(here.length / teamCount) : ""} per side`
                : "Pick at least 2 players"}
            </p>
          </div>
          <div className="flex gap-1.5">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setTeamCount(n);
                  setResult(null);
                }}
                disabled={n > maxTeams}
                aria-pressed={teamCount === n}
                className={`h-10 w-10 rounded-xl border font-mono text-sm transition disabled:opacity-25 ${
                  teamCount === n
                    ? "border-accent bg-accent/15 font-semibold text-accent"
                    : "border-line bg-raised text-muted"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
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
            <div className="mt-2 space-y-2 rounded-2xl border border-line bg-surface p-3">
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
                    className="flex items-center gap-2 rounded-xl bg-raised px-3 py-2 text-sm"
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
                      className="px-1 text-muted hover:text-red-300"
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
                }}
              />
            </div>
          )}
        </section>

        <Button
          onClick={() => generate(Math.floor(Math.random() * 1e9))}
          disabled={here.length < 2}
          className="w-full py-4 text-base"
        >
          {result ? "Regenerate" : "Generate teams"}
        </Button>
      </div>

      <div className="mt-6 lg:mt-0">
        {!result && (
          <div className="hidden h-full min-h-64 place-content-center rounded-2xl border border-dashed border-line px-6 text-center lg:grid">
            <p className="text-sm text-muted">
              {here.length < 2
                ? "Tap who showed up to get started."
                : `${here.length} in. Hit generate.`}
            </p>
          </div>
        )}

        {result && (
          <section className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">
                Spread{" "}
                <span
                  className={`font-mono tabular-nums ${result.spread <= 1 ? "text-emerald-400" : result.spread <= 3 ? "text-amber-400" : "text-orange-400"}`}
                >
                  {result.spread.toFixed(1)}
                </span>
              </span>
              <button
                onClick={() => generate(seed + 1)}
                className="text-accent hover:underline"
              >
                Reshuffle
              </button>
            </div>

            {result.unmet.length > 0 && (
              <p className="rounded-xl border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                Couldn&apos;t satisfy {result.unmet.length} rule
                {result.unmet.length > 1 ? "s" : ""} with this group.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {result.teams.map((team, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">Team {i + 1}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="font-mono tabular-nums">
                        avg {team.average}
                      </span>
                      <Rating value={Math.round(team.average)} size="sm" />
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {team.players.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <span className="w-8 shrink-0 font-mono text-[10px] uppercase text-muted">
                          {positionLabel.get(p.position) ?? p.position}
                        </span>
                        <span className="flex-1">{p.name}</span>
                        <span className="font-mono text-xs tabular-nums text-muted">
                          {p.overall}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Button variant="ghost" onClick={share} className="w-full sm:max-w-xs">
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
    "min-w-0 flex-1 rounded-lg border border-line bg-raised px-2 py-2 text-sm outline-none focus:border-accent";

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
        className="rounded-lg border border-line bg-raised px-2.5 py-2 text-xs text-accent"
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
