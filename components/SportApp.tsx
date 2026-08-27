"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { removePlayer, savePlayer, type RosterEntry } from "@/app/actions";
import PasscodeGate from "@/components/PasscodeGate";
import PlayerCard from "@/components/PlayerCard";
import PlayerEditor, { type EditorTarget } from "@/components/PlayerEditor";
import RunTab from "@/components/RunTab";
import { Button, EmptyState, Rating } from "@/components/ui";
import { computeOverall, formatHeight, type SportConfig } from "@/lib/sports";

type Tab = "run" | "roster";

export default function SportApp({
  config,
  initialRoster,
  access,
}: {
  config: SportConfig;
  initialRoster: RosterEntry[];
  access: { gated: boolean; unlocked: boolean };
}) {
  const [tab, setTab] = useState<Tab>("run");
  const [roster, setRoster] = useState(initialRoster);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  /** The player whose ratings are being read. Viewing is never gated. */
  const [viewing, setViewing] = useState<RosterEntry | null>(null);
  const [unlocked, setUnlocked] = useState(!access.gated || access.unlocked);
  /** Held while the passcode is asked for, then opened once it's accepted. */
  const [afterUnlock, setAfterUnlock] = useState<EditorTarget | null>(null);

  /** Editing is gated, so route every entry point through the same check. */
  function requestEdit(target: EditorTarget) {
    setViewing(null);
    if (unlocked) setEditor(target);
    else setAfterUnlock(target);
  }
  const [pending, startTransition] = useTransition();

  function handleSave(input: {
    playerId?: string;
    name: string;
    position: string;
    ratings: Record<string, number>;
    heightInches: number | null;
  }) {
    startTransition(async () => {
      const { playerId } = await savePlayer({ ...input, sport: config.id });
      const entry: RosterEntry = {
        id: playerId,
        name: input.name.trim(),
        position: input.position,
        ratings: input.ratings,
        heightInches: input.heightInches,
        overall: computeOverall(config, input.ratings),
      };
      setRoster((prev) => {
        const without = prev.filter((p) => p.id !== playerId);
        return [...without, entry].sort(
          (x, y) => y.overall - x.overall || x.name.localeCompare(y.name),
        );
      });
      setEditor(null);
    });
  }

  function handleDelete(playerId: string) {
    startTransition(async () => {
      await removePlayer(playerId, config.id);
      setRoster((prev) => prev.filter((p) => p.id !== playerId));
      setEditor(null);
    });
  }

  return (
    <div
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-16 pt-6 lg:max-w-6xl lg:px-8 lg:pt-10"
      style={
        {
          // The lighter and darker accents are derived so a sport only ever
          // declares one colour.
          "--accent": config.accent,
          "--accent-strong": `color-mix(in srgb, ${config.accent} 82%, black)`,
          "--accent-wash": `color-mix(in srgb, ${config.accent} 9%, white)`,
          "--accent-line": `color-mix(in srgb, ${config.accent} 32%, white)`,
        } as React.CSSProperties
      }
    >
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            aria-label="Back to sports"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted shadow-[var(--shadow-card)] transition hover:border-accent-line hover:text-foreground"
          >
            ←
          </Link>
          {/* The sport's colour has to appear somewhere solid, or the accent
              only ever exists as a tint nobody registers. */}
          <h1 className="text-xl font-bold tracking-tight">
            <span aria-hidden className="mr-1.5">
              {config.emoji}
            </span>
            {config.label}
          </h1>
          <div className="min-w-0">
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={() => requestEdit({ mode: "new" })}
          className="shrink-0 !px-3 !py-2"
        >
          + Player
        </Button>
      </header>

      <div
        role="tablist"
        className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-line bg-sunken p-1 shadow-inner lg:max-w-sm"
      >
        {(
          [
            ["run", "Run it"],
            ["roster", `Roster · ${roster.length}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg py-2.5 text-sm transition ${
              tab === key
                ? "bg-surface font-semibold text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "run" ? (
        <RunTab
          config={config}
          roster={roster}
          onAddPlayer={() => requestEdit({ mode: "new" })}
        />
      ) : (
        <RosterList config={config} roster={roster} onOpen={setViewing} />
      )}

      {viewing && (
        <PlayerCard
          config={config}
          player={viewing}
          rank={roster.findIndex((p) => p.id === viewing.id) + 1}
          of={roster.length}
          onClose={() => setViewing(null)}
          onEdit={() => requestEdit({ mode: "edit", player: viewing })}
        />
      )}

      {afterUnlock && (
        <PasscodeGate
          onClose={() => setAfterUnlock(null)}
          onUnlocked={() => {
            setUnlocked(true);
            setEditor(afterUnlock);
            setAfterUnlock(null);
          }}
        />
      )}

      {editor && (
        <PlayerEditor
          config={config}
          target={editor}
          busy={pending}
          onClose={() => setEditor(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function RosterList({
  config,
  roster,
  onOpen,
}: {
  config: SportConfig;
  roster: RosterEntry[];
  onOpen: (player: RosterEntry) => void;
}) {
  if (roster.length === 0) {
    return (
      <EmptyState
        title="Empty roster"
        body={`Add everyone who runs with you. Rate them once — the app remembers, so you never explain the group to anything again.`}
      />
    );
  }

  const positions = new Map(config.positions.map((p) => [p.key, p]));

  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {roster.map((p, i) => (
        <li key={p.id}>
          <button
            onClick={() => onOpen(p)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left shadow-[var(--shadow-card)] transition hover:border-accent-line hover:shadow-md active:translate-y-px"
          >
            {/* The list is sorted by rating, so say so — otherwise the order is
                information the eye has to reconstruct from the numbers. */}
            <span className="figure w-6 shrink-0 text-center text-xs font-semibold text-muted/70">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">
                {p.name}
              </span>
              <span className="block truncate text-xs text-muted">
                {positions.get(p.position)?.full ?? p.position}
                {formatHeight(p.heightInches) && (
                  <> · {formatHeight(p.heightInches)}</>
                )}
              </span>
            </span>
            <Rating value={p.overall} />
          </button>
        </li>
      ))}
    </ul>
  );
}
