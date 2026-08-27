"use client";

import { useMemo } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { teamColor } from "@/components/ui";
import type { BalancePlayer } from "@/lib/balance";
import type { SportConfig } from "@/lib/sports";

export type Matchup = {
  position: string;
  label: string;
  full: string;
  /** Index 0 is the first team, 1 the second. Either may be absent. */
  players: (BalancePlayer | null)[];
};

/**
 * Half-court spots as percentages of the court box. Laid out the way you'd
 * look at a half court: bigs near the rim at the top, guards out front.
 */
const SPOTS: Record<string, { x: number; y: number }> = {
  c: { x: 30, y: 17 },
  pf: { x: 70, y: 17 },
  sf: { x: 23, y: 53 },
  sg: { x: 77, y: 53 },
  pg: { x: 50, y: 80 },
};

/**
 * Slots from biggest to smallest. Used only to place players who could not get
 * their own position, so the tallest spare ends up nearest the rim rather than
 * a 5'5" guard landing at centre.
 */
const SIZE_ORDER = ["c", "pf", "sf", "sg", "pg"] as const;

/**
 * Pairs each team's players by position. Anyone whose position is already
 * taken on their own team spills into the next open spot, so ten players
 * always land somewhere rather than silently vanishing.
 */
export function buildMatchups(
  config: SportConfig,
  teams: BalancePlayer[][],
): Matchup[] {
  const order = config.positions.filter((p) => SPOTS[p.key]);
  const slots: Matchup[] = order.map((p) => ({
    position: p.key,
    label: p.label,
    full: p.full,
    players: teams.map(() => null),
  }));

  teams.forEach((roster, teamIndex) => {
    const leftover: BalancePlayer[] = [];
    for (const player of roster) {
      const slot = slots.find(
        (s) => s.position === player.position && s.players[teamIndex] === null,
      );
      if (slot) slot.players[teamIndex] = player;
      else leftover.push(player);
    }
    // Tallest spare takes the biggest open spot. Unknown heights sit in the
    // middle rather than being treated as short.
    const height = (p: BalancePlayer) => p.heightInches ?? 70;
    leftover.sort((a, b) => height(b) - height(a) || b.overall - a.overall);

    const openBySize = SIZE_ORDER.map((key) =>
      slots.find((s) => s.position === key && s.players[teamIndex] === null),
    ).filter((s): s is Matchup => Boolean(s));

    leftover.forEach((player, i) => {
      const slot = openBySize[i];
      if (slot) slot.players[teamIndex] = player;
    });

    settleByHeight(slots, teamIndex);
  });

  return slots;
}

/**
 * Swaps players between spots when someone at a bigger spot is well shorter
 * than someone at a smaller one.
 *
 * The tolerance is the point: an inch or two either way leaves a stated
 * position alone, because the game really is positionless. It only steps in
 * for the placement anyone would object to — a 5'5" guard at centre while a
 * 6'2" teammate runs the point.
 */
const HEIGHT_TOLERANCE = 3;

function settleByHeight(slots: Matchup[], teamIndex: number) {
  const bySize = SIZE_ORDER.map((key) =>
    slots.find((s) => s.position === key),
  ).filter((s): s is Matchup => Boolean(s));

  const height = (p: BalancePlayer | null) => p?.heightInches ?? 70;

  for (let pass = 0; pass < bySize.length; pass++) {
    let swapped = false;
    for (let i = 0; i < bySize.length; i++) {
      for (let j = i + 1; j < bySize.length; j++) {
        const bigger = bySize[i].players[teamIndex];
        const smaller = bySize[j].players[teamIndex];
        if (!bigger || !smaller) continue;
        if (height(smaller) - height(bigger) > HEIGHT_TOLERANCE) {
          bySize[i].players[teamIndex] = smaller;
          bySize[j].players[teamIndex] = bigger;
          swapped = true;
        }
      }
    }
    if (!swapped) break;
  }
}

export default function CourtView({
  matchups,
  teamCount,
}: {
  matchups: Matchup[];
  teamCount: number;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-sunken shadow-[var(--shadow-card)]">
      <CourtMarkings />
      <div className="relative aspect-[3/4] w-full sm:aspect-[5/4]">
        {matchups.map((m) => {
          const spot = SPOTS[m.position];
          if (!spot) return null;
          return (
            <div
              key={m.position}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
            >
              <MatchupCard matchup={m} teamCount={teamCount} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CourtMarkings() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full text-line-strong"
    >
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
      />
      {/* Paint */}
      <rect
        x="38"
        y="1"
        width="24"
        height="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
      />
      {/* Free-throw circle */}
      <circle
        cx="50"
        cy="31"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
      />
      {/* Three-point arc */}
      <path
        d="M 12 1 L 12 26 A 38 38 0 0 0 88 26 L 88 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
      />
      {/* Rim */}
      <circle
        cx="50"
        cy="7"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </svg>
  );
}

function MatchupCard({
  matchup,
  teamCount,
}: {
  matchup: Matchup;
  teamCount: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `spot-${matchup.position}`,
  });

  // Whoever is ahead owns the delta, so the sign can't be read backwards.
  const lead = useMemo(() => {
    const [a, b] = matchup.players;
    if (!a || !b || teamCount !== 2) return null;
    if (a.overall === b.overall) return { index: -1, delta: 0 };
    return a.overall > b.overall
      ? { index: 0, delta: a.overall - b.overall }
      : { index: 1, delta: b.overall - a.overall };
  }, [matchup.players, teamCount]);

  return (
    <div
      ref={setNodeRef}
      className={`w-[7.25rem] rounded-xl border bg-surface/95 p-1.5 sm:p-2 shadow-[var(--shadow-card)] backdrop-blur-sm transition sm:w-40 ${
        isOver ? "border-accent ring-2 ring-accent/25" : "border-line"
      }`}
    >
      <div className="mb-1 flex items-baseline justify-between px-0.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
          {matchup.label}
        </span>
        {lead && lead.index === -1 && (
          <span className="text-[10px] text-muted">even</span>
        )}
      </div>

      <div className="space-y-0.5">
        {matchup.players.map((player, i) => (
          <PlayerSlot
            key={i}
            player={player}
            teamIndex={i}
            delta={lead && lead.index === i ? lead.delta : null}
          />
        ))}
      </div>

      {lead && lead.index >= 0 && (
        <AdvantageBar teamIndex={lead.index} delta={lead.delta} />
      )}
    </div>
  );
}

function PlayerSlot({
  player,
  teamIndex,
  delta,
}: {
  player: BalancePlayer | null;
  teamIndex: number;
  delta: number | null;
}) {
  const color = teamColor(teamIndex);

  if (!player) {
    return (
      <div className="flex items-center gap-1.5 rounded-md px-1 py-1 text-xs text-muted">
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${color.dot} opacity-30`}
        />
        <span className="italic opacity-60">open</span>
      </div>
    );
  }

  return (
    <DraggablePlayer player={player} teamIndex={teamIndex} delta={delta} />
  );
}

function DraggablePlayer({
  player,
  teamIndex,
  delta,
}: {
  player: BalancePlayer;
  teamIndex: number;
  delta: number | null;
}) {
  const color = teamColor(teamIndex);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex touch-none items-center gap-1.5 rounded-md px-1 py-1 text-xs transition ${
        isDragging
          ? "opacity-30"
          : "cursor-grab hover:bg-sunken active:cursor-grabbing"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${color.dot}`}
      />
      <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
      <span className="font-mono tabular-nums text-muted">
        {player.overall}
      </span>
      {delta !== null && (
        <span
          className={`rounded px-1 font-mono text-[10px] font-semibold ${color.chip}`}
        >
          +{delta}
        </span>
      )}
    </div>
  );
}

/** Fills toward the stronger side and names the team, so nothing is implied. */
function AdvantageBar({
  teamIndex,
  delta,
}: {
  teamIndex: number;
  delta: number;
}) {
  const color = teamColor(teamIndex);
  // 20 points of separation reads as a full bar.
  const share = Math.min(100, 50 + (delta / 20) * 50);
  const width = teamIndex === 0 ? share : 100 - share;

  return (
    <div className="mt-1.5 px-0.5">
      <div className="h-1 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full ${color.dot} transition-all`}
          style={{
            width: `${teamIndex === 0 ? width : 100 - width}%`,
            marginLeft: teamIndex === 0 ? 0 : `${width}%`,
          }}
        />
      </div>
      <p className="mt-1 text-center text-[10px] font-medium text-muted">
        {color.label} +{delta}
      </p>
    </div>
  );
}
