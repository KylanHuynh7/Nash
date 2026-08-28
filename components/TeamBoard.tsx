"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { Rating, teamColor } from "@/components/ui";
import CourtView, { type SwapState } from "@/components/CourtView";
import { buildMatchups } from "@/lib/lineup";
import {
  BENCH,
  boardSpread,
  move,
  pinToSpot,
  swap as swapPlayers,
  teamAverage,
  teamId,
  type Board,
} from "@/lib/board";
import type { SportConfig } from "@/lib/sports";
import type { BalancePlayer } from "@/lib/balance";

export { boardSpread, teamAverage, type Board };

export default function TeamBoard({
  board,
  onChange,
  positionLabel,
  config,
  view,
}: {
  board: Board;
  onChange: (next: Board) => void;
  positionLabel: Map<string, string>;
  config: SportConfig;
  view: "list" | "court";
}) {
  const [dragging, setDragging] = useState<BalancePlayer | null>(null);

  /**
   * Tap-to-swap: who is waiting for somewhere to go.
   *
   * Held here rather than in CourtView because a board change has to clear it -
   * a regenerate wipes the pins, and a selection pointing at a lineup that no
   * longer exists would light up the wrong slot.
   */
  const [selected, setSelected] = useState<{
    id: string;
    team: number | null;
  } | null>(null);

  /*
   * A selection is only live while the player is still where it says he is.
   * Regenerating rebuilds both sides, and a selection pointing into the old
   * lineup would light up the wrong slot on the new one. `team: null` means
   * the bench, which is a valid place to be selected from - picking someone up
   * off the bench and tapping a player on the floor is a substitution.
   */
  const selectionLive =
    selected !== null &&
    (selected.team === null
      ? board.bench.some((p) => p.id === selected.id)
      : Boolean(board.teams[selected.team]?.some((p) => p.id === selected.id)));
  const live = selectionLive ? selected : null;

  // A short press-and-hold on touch keeps the page scrollable; on mouse a few
  // pixels of travel distinguishes a drag from a click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  /*
   * One tap picks a player up, the second says where he goes. What the second
   * tap means depends on what it lands on:
   *
   *  - a spot on his own side          rearrange that lineup (pinToSpot)
   *  - a player on another side        the two switch sides (swap)
   *  - a player on the bench           a substitution (swap)
   *
   * Only the first changes a lineup without changing who is on which team,
   * which is why it stays a separate operation rather than a special case.
   */
  const swapState = {
    selectedId: live?.id ?? null,
    selectedTeam: live?.team ?? null,
    onSelect: (playerId: string | null, teamIndex: number | null) =>
      setSelected(playerId ? { id: playerId, team: teamIndex } : null),
    onSwap: (spot: string) => {
      if (!live || live.team === null) return;
      onChange(pinToSpot(board, config, live.id, spot));
      setSelected(null);
    },
    onSwapWith: (playerId: string) => {
      if (!live) return;
      onChange(swapPlayers(board, config, live.id, playerId));
      setSelected(null);
    },
  };

  const sizes = board.teams.map((t) => t.length);
  const uneven =
    sizes.length > 1 && Math.max(...sizes) - Math.min(...sizes) > 0;

  function handleStart(event: DragStartEvent) {
    // A drag supersedes a pending tap; leaving both armed means the drop lands
    // and then the click that follows it swaps a second pair.
    setSelected(null);
    const all = [...board.teams.flat(), ...board.bench];
    setDragging(all.find((p) => p.id === event.active.id) ?? null);
  }

  function handleEnd(event: DragEndEvent) {
    const dropped = dragging;
    setDragging(null);
    const over = event.over?.id;
    if (typeof over !== "string" || !dropped) return;

    // On the court, dropping onto a spot rearranges that team's own lineup
    // rather than changing teams — the spot belongs to both sides at once.
    if (over.startsWith("spot-")) {
      onChange(pinToSpot(board, config, dropped.id, over.slice("spot-".length)));
      return;
    }

    onChange(move(board, String(event.active.id), over));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={() => setDragging(null)}
    >
      {view === "court" && (
        <SwapHint active={Boolean(live)} fromBench={live?.team === null} />
      )}

      {view === "court" ? (
        <CourtView
          matchups={buildMatchups(config, board.teams, board.pinned)}
          teamCount={board.teams.length}
          config={config}
          swap={swapState}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {board.teams.map((players, i) => (
            <Column
              key={teamId(i)}
              id={teamId(i)}
              title={teamColor(i).label}
              colorIndex={i}
              players={players}
              positionLabel={positionLabel}
              flagSize={uneven}
            />
          ))}
        </div>
      )}

      <Column
        id={BENCH}
        title="Next up"
        subtitle="sitting this game"
        players={board.bench}
        positionLabel={positionLabel}
        muted
        swap={swapState}
        teamIndex={null}
      />

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="flex w-56 rotate-1 cursor-grabbing items-center gap-2.5 rounded-xl border border-accent bg-surface px-3 py-2 text-sm shadow-[var(--shadow-lift)]">
            <span className="w-8 shrink-0 font-mono text-[10px] uppercase text-muted">
              {positionLabel.get(dragging.position) ?? dragging.position}
            </span>
            <span className="flex-1 font-medium">{dragging.name}</span>
            <span className="font-mono text-xs tabular-nums text-muted">
              {dragging.overall}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * Says the board is tappable, because nothing else does.
 *
 * Dragging at least looks draggable. Two-tap swapping is invisible until
 * someone happens to tap a player, and the people using this are standing on a
 * court deciding whether to bother.
 */
function SwapHint({
  active,
  fromBench,
}: {
  active: boolean;
  fromBench: boolean;
}) {
  return (
    <p
      className={`mb-2 text-center text-xs transition ${
        active ? "font-medium text-accent-ink" : "text-ink-soft"
      }`}
    >
      {active
        ? fromBench
          ? "Now tap whoever he comes on for — or tap him again to cancel."
          : "Now tap a spot on his own side, a player on the other, or someone on the bench."
        : "Tap a player, then tap where he should go. Sides keep their size."}
    </p>
  );
}

function Column({
  id,
  title,
  subtitle,
  players,
  positionLabel,
  muted,
  flagSize,
  colorIndex,
  swap,
  teamIndex,
}: {
  id: string;
  title: string;
  subtitle?: string;
  players: BalancePlayer[];
  positionLabel: Map<string, string>;
  muted?: boolean;
  flagSize?: boolean;
  colorIndex?: number;
  swap?: SwapState;
  /** Which side this column is, or null for the bench. */
  teamIndex?: number | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const average = useMemo(() => teamAverage(players), [players]);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border p-4 shadow-[var(--shadow-card)] transition ${
        isOver
          ? "border-accent bg-accent-wash ring-2 ring-accent/20"
          : muted
            ? "border-dashed border-line-strong bg-sunken"
            : "border-line bg-surface"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          {colorIndex !== undefined && (
            <span
              aria-hidden
              className={`h-2.5 w-2.5 rounded-full ${teamColor(colorIndex).dot}`}
            />
          )}
          {title}
        </h3>
        {subtitle ? (
          <span className="text-xs text-muted">{subtitle}</span>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span
              className={`font-mono tabular-nums ${flagSize ? "font-semibold text-amber-400" : ""}`}
            >
              {players.length} · avg {average}
            </span>
            <Rating value={Math.round(average)} size="sm" />
          </div>
        )}
      </div>

      {players.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted">Drop someone here</p>
      ) : (
        <ul className="space-y-1">
          {players.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              positionLabel={positionLabel}
              swap={swap}
              teamIndex={teamIndex ?? null}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  positionLabel,
  swap,
  teamIndex,
}: {
  player: BalancePlayer;
  positionLabel: Map<string, string>;
  swap?: SwapState;
  teamIndex: number | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
  });

  const selected = Boolean(swap && swap.selectedId === player.id);
  // Anyone not on the selected player's own side is someone he can switch
  // with. His own side is a lineup rearrangement, which happens on the court
  // by tapping a spot rather than by tapping a team-mate.
  const targetable = Boolean(
    swap && swap.selectedId && !selected && swap.selectedTeam !== teamIndex,
  );

  function handleClick() {
    if (!swap) return;
    if (targetable) swap.onSwapWith(player.id);
    else if (selected) swap.onSelect(null, teamIndex);
    else swap.onSelect(player.id, teamIndex);
  }

  const state = selected
    ? "bg-accent-wash ring-2 ring-accent font-semibold"
    : targetable
      ? "outline-1 outline-dashed outline-accent/70 hover:bg-accent-wash"
      : "hover:bg-sunken";

  return (
    <li
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
      className={`flex touch-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition ${
        isDragging
          ? "opacity-30"
          : `cursor-grab active:cursor-grabbing ${state}`
      }`}
    >
      <span className="w-8 shrink-0 font-mono text-[10px] uppercase text-muted">
        {positionLabel.get(player.position) ?? player.position}
      </span>
      <span className="flex-1">{player.name}</span>
      <span className="font-mono text-xs tabular-nums text-muted">
        {player.overall}
      </span>
    </li>
  );
}
