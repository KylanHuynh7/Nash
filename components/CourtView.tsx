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
 * Pairs each team's players by position. Anyone whose position is already
 * taken on their own team spills into the next open spot, so ten players
 * always land somewhere rather than silently vanishing.
 */
export function buildMatchups(
  config: SportConfig,
  teams: BalancePlayer[][],
  /** Player id -> the spot they were dropped on. */
  pinned: Record<string, string> = {},
): Matchup[] {
  const isPinned = new Set(Object.keys(pinned));
  const slots: Matchup[] = config.spots.map((spot) => ({
    position: spot.key,
    label: spot.label,
    full: spot.full,
    players: teams.map(() => null),
  }));
  // Which roster position claims each spot. Several spots can want the same
  // one — three of football's five are WR — so this isn't the spot key.
  const claimedBy = config.spots.map((spot) => spot.position ?? spot.key);

  teams.forEach((roster, teamIndex) => {
    const leftover: BalancePlayer[] = [];

    // Hand-placed players claim the exact spot they were dropped on, before
    // anyone else can take it. Anyone left over is placed by position below.
    const automatic: BalancePlayer[] = [];
    for (const player of roster) {
      const wanted = pinned[player.id];
      if (wanted === undefined) {
        automatic.push(player);
        continue;
      }
      const at = slots.findIndex(
        (s) => s.position === wanted && s.players[teamIndex] === null,
      );
      if (at !== -1) slots[at].players[teamIndex] = player;
      else automatic.push(player);
    }

    for (const player of automatic) {
      const at = slots.findIndex(
        (s, i) => claimedBy[i] === player.position && s.players[teamIndex] === null,
      );
      if (at !== -1) slots[at].players[teamIndex] = player;
      else leftover.push(player);
    }
    // Anyone who reached this point without their own position was put
    // somewhere by us, not by them. Only those placements are up for settling.
    const spilled = new Set(leftover.map((p) => p.id));
    // Tallest spare takes the biggest open spot. Unknown heights sit in the
    // middle rather than being treated as short.
    const height = (p: BalancePlayer) => p.heightInches ?? 70;
    leftover.sort((a, b) => height(b) - height(a) || b.overall - a.overall);

    const openBySize = config.sizeOrder
      .map((key) =>
        slots.find((s) => s.position === key && s.players[teamIndex] === null),
      )
      .filter((s): s is Matchup => Boolean(s));

    leftover.forEach((player, i) => {
      const slot = openBySize[i];
      if (slot) slot.players[teamIndex] = player;
    });

    settleByHeight(slots, config.sizeOrder, teamIndex, isPinned, spilled);
  });

  return slots;
}

/**
 * Swaps players between spots when someone at a bigger spot is well shorter
 * than someone at a smaller one.
 *
 * Only ever moves a player *we* placed. Someone standing at the position he
 * asked for stated a preference, and the game is positionless enough that we
 * have no business overriding it — that is what made a stated point guard the
 * tallest man on his team and get dragged to power forward.
 *
 * So a swap needs at least one spillover player in it. That still fixes the
 * placement anyone would object to — a 5'5" guard we dropped at centre while a
 * 6'2" teammate runs the point — without touching a board nobody complained
 * about. The tolerance leaves near-matches alone on top of that.
 */
const HEIGHT_TOLERANCE = 3;

function settleByHeight(
  slots: Matchup[],
  sizeOrder: string[],
  teamIndex: number,
  pinned: Set<string>,
  spilled: Set<string>,
) {
  const bySize = sizeOrder
    .map((key) => slots.find((s) => s.position === key))
    .filter((s): s is Matchup => Boolean(s));

  const height = (p: BalancePlayer | null) => p?.heightInches ?? 70;

  for (let pass = 0; pass < bySize.length; pass++) {
    let swapped = false;
    for (let i = 0; i < bySize.length; i++) {
      for (let j = i + 1; j < bySize.length; j++) {
        const bigger = bySize[i].players[teamIndex];
        const smaller = bySize[j].players[teamIndex];
        if (!bigger || !smaller) continue;
        // A spot someone chose by hand is not up for rearranging.
        if (pinned.has(bigger.id) || pinned.has(smaller.id)) continue;
        // Neither of them is somewhere we put them, so there is nothing to fix.
        if (!spilled.has(bigger.id) && !spilled.has(smaller.id)) continue;
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
  config,
}: {
  matchups: Matchup[];
  teamCount: number;
  config: SportConfig;
}) {
  const spots = new Map(config.spots.map((s) => [s.key, s]));
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-line bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_srgb,var(--accent)_14%,var(--surface-sunken)),var(--surface-sunken))] shadow-[var(--shadow-card)]">
      {config.id === "football" ? <FieldMarkings /> : <CourtMarkings />}
      <div className="relative aspect-[3/4] w-full sm:aspect-[5/4]">
        {matchups.map((m) => {
          const spot = spots.get(m.position);
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
      className="pointer-events-none absolute inset-0 h-full w-full text-white/25"
    >
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.55"
      />
      {/* Paint */}
      <rect
        x="38"
        y="1"
        width="24"
        height="30"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.55"
      />
      {/* Free-throw circle */}
      <circle
        cx="50"
        cy="31"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.55"
      />
      {/* Three-point arc */}
      <path
        d="M 12 1 L 12 26 A 38 38 0 0 0 88 26 L 88 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.55"
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

/** Yard lines running away from a end zone, with the snap up front. */
function FieldMarkings() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full text-white/25"
    >
      <rect
        x="1"
        y="1"
        width="98"
        height="98"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.55"
      />
      {/* End zone across the top */}
      <rect
        x="1"
        y="1"
        width="98"
        height="12"
        fill="currentColor"
        opacity="0.07"
      />
      <line
        x1="1"
        y1="13"
        x2="99"
        y2="13"
        stroke="currentColor"
        strokeWidth="0.6"
      />
      {/* Yard lines */}
      {[26, 39, 52, 65].map((y) => (
        <line
          key={y}
          x1="1"
          y1={y}
          x2="99"
          y2={y}
          stroke="currentColor"
          strokeWidth="0.3"
        />
      ))}
      {/* Hash marks down the middle */}
      {[19.5, 32.5, 45.5, 58.5, 71.5].map((y) => (
        <g key={y}>
          <line
            x1="33"
            y1={y}
            x2="36"
            y2={y}
            stroke="currentColor"
            strokeWidth="0.3"
          />
          <line
            x1="64"
            y1={y}
            x2="67"
            y2={y}
            stroke="currentColor"
            strokeWidth="0.3"
          />
        </g>
      ))}
      {/* Line of scrimmage */}
      <line
        x1="1"
        y1="71"
        x2="99"
        y2="71"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeDasharray="2 1.5"
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
