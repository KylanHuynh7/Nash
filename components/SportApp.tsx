"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { removePlayer, savePlayer, type RosterEntry } from "@/app/actions";
import PlayerEditor, { type EditorTarget } from "@/components/PlayerEditor";
import RunTab from "@/components/RunTab";
import { Button, EmptyState, Rating } from "@/components/ui";
import { computeOverall, formatHeight, type SportConfig } from "@/lib/sports";

type Tab = "run" | "roster";

export default function SportApp({
  config,
  initialRoster,
}: {
  config: SportConfig;
  initialRoster: RosterEntry[];
}) {
  const [tab, setTab] = useState<Tab>("run");
  const [roster, setRoster] = useState(initialRoster);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
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
      style={{ ["--accent" as string]: config.accent }}
    >
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            aria-label="Back to sports"
            className="text-muted transition hover:text-foreground"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold tracking-tight">
            <span aria-hidden className="mr-1.5">
              {config.emoji}
            </span>
            {config.label}
          </h1>
        </div>
        <Button
          variant="ghost"
          onClick={() => setEditor({ mode: "new" })}
          className="!px-3 !py-2"
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
          onAddPlayer={() => setEditor({ mode: "new" })}
        />
      ) : (
        <RosterList
          config={config}
          roster={roster}
          onEdit={(p) => setEditor({ mode: "edit", player: p })}
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
  onEdit,
}: {
  config: SportConfig;
  roster: RosterEntry[];
  onEdit: (player: RosterEntry) => void;
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
      {roster.map((p) => (
        <li key={p.id}>
          <button
            onClick={() => onEdit(p)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left shadow-[var(--shadow-card)] transition hover:border-accent-line hover:shadow-md active:translate-y-px"
          >
            <Rating value={p.overall} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{p.name}</span>
              <span className="block text-xs text-muted">
                {positions.get(p.position)?.full ?? p.position}
                {formatHeight(p.heightInches) && (
                  <> · {formatHeight(p.heightInches)}</>
                )}
              </span>
            </span>
            <span aria-hidden className="text-muted">
              ›
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
