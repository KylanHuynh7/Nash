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
import CourtView from "@/components/CourtView";
import { buildMatchups } from "@/lib/lineup";
import type { SportConfig } from "@/lib/sports";
import type { BalancePlayer } from "@/lib/balance";

export type Board = {
  teams: BalancePlayer[][];
  bench: BalancePlayer[];
  /**
   * Player id -> the id of the spot they were dropped on. Automatic placement
   * never moves them again — a drag is an instruction, not a suggestion.
   *
   * The spot is recorded rather than the position, because several spots can
   * share one position: dropping a receiver on the right side has to keep him
   * on the right side, and rewriting his position to the spot key would put a
   * "wr_l" into a saved run where a real position belongs.
   */
  pinned: Record<string, string>;
};

const BENCH = "bench";
const teamId = (index: number) => `team-${index}`;

export function teamAverage(players: BalancePlayer[]): number {
  if (players.length === 0) return 0;
  const total = players.reduce((sum, p) => sum + p.overall, 0);
  return Math.round((total / players.length) * 10) / 10;
}

export function boardSpread(board: Board): number {
  const averages = board.teams.filter((t) => t.length > 0).map(teamAverage);
  if (averages.length === 0) return 0;
  return Math.round((Math.max(...averages) - Math.min(...averages)) * 10) / 10;
}

function findContainer(board: Board, playerId: string): string | null {
  for (let i = 0; i < board.teams.length; i++) {
    if (board.teams[i].some((p) => p.id === playerId)) return teamId(i);
  }
  return board.bench.some((p) => p.id === playerId) ? BENCH : null;
}

function move(board: Board, playerId: string, to: string): Board {
  const from = findContainer(board, playerId);
  if (!from || from === to) return board;

  const all = [...board.teams.flat(), ...board.bench];
  const player = all.find((p) => p.id === playerId);
  if (!player) return board;

  const strip = (list: BalancePlayer[]) =>
    list.filter((p) => p.id !== playerId);
  const teams = board.teams.map(strip);
  let bench = strip(board.bench);

  if (to === BENCH) {
    bench = [...bench, player];
  } else {
    const index = Number(to.slice("team-".length));
    if (!Number.isInteger(index) || !teams[index]) return board;
    teams[index] = [...teams[index], player].sort(
      (a, b) => b.overall - a.overall,
    );
  }

  // Changing team drops the pin: the spot it referred to was on the old side.
  const pinned = Object.fromEntries(
    Object.entries(board.pinned).filter(([id]) => id !== playerId),
  );
  return { teams, bench, pinned };
}

/**
 * Puts a player on the spot they were dropped on and sends whoever was there
 * back to the spot they came from — a straight swap of two players.
 *
 * Position is not consulted and cannot block the move: putting a guard at
 * centre to see him handle a big is the point of dragging, not a mistake to
 * correct. Both ends of the swap get pinned, so automatic placement and the
 * height pass leave the whole board alone afterwards and one drag moves
 * exactly two people.
 */
function pinToSpot(
  board: Board,
  config: SportConfig,
  playerId: string,
  spot: string,
): Board {
  const teamIndex = board.teams.findIndex((t) =>
    t.some((p) => p.id === playerId),
  );
  // Dropping a benched player onto a spot says nothing about which side he's
  // joining, so it isn't a move we can make sense of.
  if (teamIndex === -1) return board;

  const matchups = buildMatchups(config, board.teams, board.pinned);
  const from = matchups.find((m) => m.players[teamIndex]?.id === playerId);
  if (!from || from.position === spot) return board;

  const target = matchups.find((m) => m.position === spot);
  if (!target) return board;

  const pinned = { ...board.pinned, [playerId]: spot };
  const displaced = target.players[teamIndex];
  if (displaced) pinned[displaced.id] = from.position;

  return { ...board, pinned };
}

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
    team: number;
  } | null>(null);

  // The selected player may have been regenerated away or moved to the bench.
  const selectionLive =
    selected !== null &&
    board.teams[selected.team]?.some((p) => p.id === selected.id);
  const live = selectionLive ? selected : null;

  // A short press-and-hold on touch keeps the page scrollable; on mouse a few
  // pixels of travel distinguishes a drag from a click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

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
      {view === "court" && <SwapHint active={Boolean(live)} />}

      {view === "court" ? (
        <CourtView
          matchups={buildMatchups(config, board.teams, board.pinned)}
          teamCount={board.teams.length}
          config={config}
          swap={{
            selectedId: live?.id ?? null,
            selectedTeam: live?.team ?? null,
            onSelect: (playerId, teamIndex) =>
              setSelected(playerId ? { id: playerId, team: teamIndex } : null),
            onSwap: (spot) => {
              if (!live) return;
              onChange(pinToSpot(board, config, live.id, spot));
              setSelected(null);
            },
          }}
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
function SwapHint({ active }: { active: boolean }) {
  return (
    <p
      className={`mb-2 text-center text-xs transition ${
        active ? "font-medium text-accent-ink" : "text-ink-soft"
      }`}
    >
      {active
        ? "Now tap where he should go — or tap him again to cancel."
        : "Tap a player, then tap a spot on his own team to swap them."}
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
}: {
  id: string;
  title: string;
  subtitle?: string;
  players: BalancePlayer[];
  positionLabel: Map<string, string>;
  muted?: boolean;
  flagSize?: boolean;
  colorIndex?: number;
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
            <PlayerRow key={p.id} player={p} positionLabel={positionLabel} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  positionLabel,
}: {
  player: BalancePlayer;
  positionLabel: Map<string, string>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
  });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex touch-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition ${
        isDragging
          ? "opacity-30"
          : "cursor-grab hover:bg-sunken active:cursor-grabbing"
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
