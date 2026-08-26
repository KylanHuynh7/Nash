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
import { Rating } from "@/components/ui";
import type { BalancePlayer } from "@/lib/balance";

export type Board = {
  teams: BalancePlayer[][];
  bench: BalancePlayer[];
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

  const strip = (list: BalancePlayer[]) => list.filter((p) => p.id !== playerId);
  const teams = board.teams.map(strip);
  let bench = strip(board.bench);

  if (to === BENCH) {
    bench = [...bench, player];
  } else {
    const index = Number(to.slice("team-".length));
    if (!Number.isInteger(index) || !teams[index]) return board;
    teams[index] = [...teams[index], player].sort((a, b) => b.overall - a.overall);
  }

  return { teams, bench };
}

export default function TeamBoard({
  board,
  onChange,
  positionLabel,
}: {
  board: Board;
  onChange: (next: Board) => void;
  positionLabel: Map<string, string>;
}) {
  const [dragging, setDragging] = useState<BalancePlayer | null>(null);

  // A short press-and-hold on touch keeps the page scrollable; on mouse a few
  // pixels of travel distinguishes a drag from a click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const sizes = board.teams.map((t) => t.length);
  const uneven = sizes.length > 1 && Math.max(...sizes) - Math.min(...sizes) > 0;

  function handleStart(event: DragStartEvent) {
    const all = [...board.teams.flat(), ...board.bench];
    setDragging(all.find((p) => p.id === event.active.id) ?? null);
  }

  function handleEnd(event: DragEndEvent) {
    setDragging(null);
    const over = event.over?.id;
    if (typeof over !== "string") return;
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
      <div className="grid gap-3 sm:grid-cols-2">
        {board.teams.map((players, i) => (
          <Column
            key={teamId(i)}
            id={teamId(i)}
            title={`Team ${i + 1}`}
            players={players}
            positionLabel={positionLabel}
            flagSize={uneven}
          />
        ))}
      </div>

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
          <div className="flex w-56 cursor-grabbing items-center gap-2.5 rounded-xl border border-accent bg-raised px-3 py-2 text-sm shadow-2xl">
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

function Column({
  id,
  title,
  subtitle,
  players,
  positionLabel,
  muted,
  flagSize,
}: {
  id: string;
  title: string;
  subtitle?: string;
  players: BalancePlayer[];
  positionLabel: Map<string, string>;
  muted?: boolean;
  flagSize?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const average = useMemo(() => teamAverage(players), [players]);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border p-4 transition-colors ${
        isOver
          ? "border-accent bg-accent/10"
          : muted
            ? "border-line bg-surface/60"
            : "border-line bg-surface"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        {subtitle ? (
          <span className="text-xs text-muted">{subtitle}</span>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className={`font-mono tabular-nums ${flagSize ? "text-amber-400" : ""}`}>
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
          : "cursor-grab hover:bg-raised active:cursor-grabbing"
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
