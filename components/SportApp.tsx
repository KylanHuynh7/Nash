"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { removePlayer, savePlayer, type RosterEntry } from "@/app/actions";
import PasscodeGate from "@/components/PasscodeGate";
import PlayerCard from "@/components/PlayerCard";
import PlayerEditor, { type EditorTarget } from "@/components/PlayerEditor";
import RunTab from "@/components/RunTab";
import SportShards from "@/components/SportShards";
import { Button, EmptyState, Rating } from "@/components/ui";
import {
  formatHeight,
  sportChrome,
  type SportConfig,
} from "@/lib/sports";

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
  const [saveError, setSaveError] = useState<string | null>(null);
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
    setSaveError(null);
    startTransition(async () => {
      let saved;
      try {
        saved = await savePlayer({ ...input, sport: config.id });
      } catch {
        /*
         * A failed save used to leave the editor open with no explanation,
         * because every line after the throw simply did not run. The common
         * cause is the passcode having lapsed, which is fixable but only if
         * somebody is told about it.
         */
        setSaveError("Couldn't save — check that editing is still unlocked.");
        return;
      }
      /*
       * Built from what the SERVER stored, never from what was typed. The
       * server clamps to the scale, so echoing the input back could leave the
       * screen showing a number the database does not hold.
       */
      const entry: RosterEntry = {
        id: saved.playerId,
        name: saved.name,
        position: saved.position,
        ratings: saved.ratings,
        heightInches: saved.heightInches,
        overall: saved.overall,
      };
      setRoster((prev) => {
        const without = prev.filter((p) => p.id !== saved.playerId);
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
      style={sportChrome(config) as React.CSSProperties}
    >
      {/*
       * body paints its gradient from :root, which is Nash's red — so without
       * this the football page would still sit on a red ground. The sport owns
       * the whole viewport, not just the elements inside it.
       */}
      <SportShards accent={config.accent} />

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
          <span
            aria-hidden
            className="cut flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-xl shadow-[0_0_22px_color-mix(in_srgb,var(--accent)_55%,transparent)]"
          >
            {config.emoji}
          </span>
          <div className="min-w-0">
            <h1 className="metal truncate text-2xl leading-none">
              {config.label}
            </h1>
            <p className="eyebrow mt-1">
              {roster.length} rated · {config.sideSize}-a-side
            </p>
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
        className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-line bg-sunken p-1 lg:max-w-sm"
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
            className={`rounded-md py-2.5 text-sm uppercase tracking-wider transition ${
              tab === key
                ? "bg-accent font-bold text-white shadow-[0_0_18px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
                : "font-semibold text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "roster" && roster.length > 0 && (
        <CompareInvite config={config} />
      )}

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
          // Keyed so opening a different player remounts with fresh comps
          // state instead of briefly showing the previous player's.
          key={viewing.id}
          config={config}
          player={viewing}
          rank={roster.findIndex((p) => p.id === viewing.id) + 1}
          of={roster.length}
          onClose={() => setViewing(null)}
          onEdit={() => requestEdit({ mode: "edit", player: viewing })}
          roster={roster}
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
          error={saveError}
          onClose={() => {
            setSaveError(null);
            setEditor(null);
          }}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/**
 * The way into the comparison collector.
 *
 * It sits on the roster tab rather than in the nav because that is where
 * someone is already looking at the ratings and, occasionally, disagreeing with
 * one. The link is the answer to that disagreement.
 */
function CompareInvite({ config }: { config: SportConfig }) {
  return (
    <Link
      href={`/compare/${config.id}`}
      className="mb-4 flex items-center gap-3 rounded-xl border border-accent-line bg-accent-wash px-4 py-3 transition hover:border-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          Think a rating is wrong?
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
          These come from one person. Answer a minute of &ldquo;who&apos;s
          better&rdquo; and the group decides instead.
        </span>
      </span>
      <span aria-hidden className="text-muted">
        →
      </span>
    </Link>
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
            className="group flex w-full items-center gap-3 rounded-lg border border-line bg-surface py-3 pl-3 pr-4 text-left shadow-[var(--shadow-card)] transition hover:border-accent hover:bg-raised active:translate-y-px"
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
