"use client";

import { useMemo } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { teamColor } from "@/components/ui";
import type { Matchup } from "@/lib/lineup";
import type { BalancePlayer } from "@/lib/balance";
import type { SportConfig } from "@/lib/sports";

/**
 * Tap-to-swap state, threaded down to each slot.
 *
 * Dragging is the wrong instrument on the surface this actually gets used on.
 * A thumb on a phone has to press and hold for 180ms, keep contact while the
 * board scrolls under it, and land inside a 7rem card. Two taps do the same job
 * with none of that, so both inputs drive the same reducer.
 */
export type SwapState = {
  /** The player waiting for somewhere to go, or null. */
  selectedId: string | null;
  /** Which team he is on, so only his own side lights up. */
  /** Which side the selected player is on, or null when he is on the bench. */
  selectedTeam: number | null;
  onSelect: (playerId: string | null, teamIndex: number | null) => void;
  /** Fires with the spot key tapped, on the selected player's own team. */
  onSwap: (spot: string) => void;
  /** Trade the selected player with this one - across sides, or with the bench. */
  onSwapWith: (playerId: string) => void;
};

export default function CourtView({
  matchups,
  teamCount,
  config,
  swap,
}: {
  matchups: Matchup[];
  teamCount: number;
  config: SportConfig;
  /** Absent on the share page, which is read-only and has no board to mutate. */
  swap?: SwapState;
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
              <MatchupCard matchup={m} teamCount={teamCount} swap={swap} />
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
  swap,
}: {
  matchup: Matchup;
  teamCount: number;
  swap?: SwapState;
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
            spot={matchup.position}
            swap={swap}
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
  spot,
  swap,
}: {
  player: BalancePlayer | null;
  teamIndex: number;
  delta: number | null;
  spot: string;
  swap?: SwapState;
}) {
  const color = teamColor(teamIndex);

  const selected = Boolean(swap && swap.selectedId === player?.id);

  /*
   * Two different things can be tapped, and they are different operations.
   *
   * On the selected player's own side, a slot is a place to stand: tapping it
   * rearranges that lineup and leaves both rosters alone. Empty slots count,
   * because moving into one displaces nobody.
   *
   * On any other side, only an occupied slot is a target, and tapping it
   * trades the two players. An empty slot over there is not a swap - it would
   * leave one team a man short - so it stays inert and the move that does that
   * deliberately is still a drag onto the column.
   */
  const own = Boolean(swap?.selectedId) && swap?.selectedTeam === teamIndex;
  const targetable = Boolean(
    swap && swap.selectedId && !selected && (own || player !== null),
  );
  const crossTeam = targetable && !own;

  if (!player) {
    // An empty slot is a real destination: moving into it leaves nobody
    // displaced. It only accepts taps while it is a live target.
    if (targetable) {
      return (
        <button
          type="button"
          onClick={() => swap?.onSwap(spot)}
          className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-xs text-accent outline-1 outline-dashed outline-accent/70 transition hover:bg-accent-wash"
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${color.dot} opacity-60`}
          />
          <span className="italic">move here</span>
        </button>
      );
    }
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
    <DraggablePlayer
      player={player}
      teamIndex={teamIndex}
      delta={delta}
      spot={spot}
      swap={swap}
      selected={selected}
      targetable={targetable}
      crossTeam={crossTeam}
    />
  );
}

function DraggablePlayer({
  player,
  teamIndex,
  delta,
  spot,
  swap,
  selected,
  targetable,
  crossTeam,
}: {
  player: BalancePlayer;
  teamIndex: number;
  delta: number | null;
  spot: string;
  swap?: SwapState;
  selected: boolean;
  targetable: boolean;
  crossTeam: boolean;
}) {
  const color = teamColor(teamIndex);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
  });

  // dnd-kit's sensors need 8px of travel or a 180ms hold before a drag starts,
  // and it suppresses the click that would otherwise follow one - so a tap and
  // a drag can share the element without a tap ever firing at the end of a drag.
  function handleClick() {
    if (!swap) return;
    if (targetable) {
      if (crossTeam) swap.onSwapWith(player.id);
      else swap.onSwap(spot);
    } else if (selected) swap.onSelect(null, teamIndex);
    else swap.onSelect(player.id, teamIndex);
  }

  // The selected player and his destinations both need to stand out from the
  // board, but they are two different things and looked like one at the same
  // ring weight. The one that was picked is filled; the ones that can be tapped
  // are only outlined, and dashed so the difference survives a glance.
  /*
   * Three states that have to stay distinguishable at a glance on a phone.
   *
   * The one that was picked is filled. Places he can go are only outlined, and
   * dashed. A target on *another* side is outlined in that side's own colour,
   * because "rearrange my lineup" and "these two switch teams" are different
   * enough that they should not look identical.
   */
  const state = selected
    ? "bg-accent-wash ring-2 ring-accent font-semibold"
    : targetable
      ? crossTeam
        ? `outline-1 outline-dashed ${color.outline} hover:bg-sunken`
        : "outline-1 outline-dashed outline-accent/70 hover:bg-accent-wash"
      : "hover:bg-sunken";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      role={swap ? "button" : undefined}
      tabIndex={swap ? 0 : undefined}
      aria-pressed={swap ? selected : undefined}
      onKeyDown={
        swap
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      className={`flex touch-none items-center gap-1.5 rounded-md px-1 py-1 text-xs transition ${
        isDragging ? "opacity-30" : `cursor-grab active:cursor-grabbing ${state}`
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
