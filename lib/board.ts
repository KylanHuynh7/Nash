/**
 * The board and the moves you can make on it.
 *
 * Pure and React-free so the moves can be tested without mounting a drag
 * context. `TeamBoard` owns the rendering and the pointer handling; everything
 * that decides *where people end up* lives here. Same split as `lib/lineup.ts`.
 */
import { buildMatchups } from "@/lib/lineup";
import type { BalancePlayer } from "@/lib/balance";
import type { SportConfig } from "@/lib/sports";

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

export const BENCH = "bench";
export const teamId = (index: number) => `team-${index}`;

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

/** Which team, or the bench, a player currently sits in. */
export function findContainer(board: Board, playerId: string): string | null {
  for (let i = 0; i < board.teams.length; i++) {
    if (board.teams[i].some((p) => p.id === playerId)) return teamId(i);
  }
  return board.bench.some((p) => p.id === playerId) ? BENCH : null;
}

function findPlayer(board: Board, playerId: string): BalancePlayer | null {
  return (
    [...board.teams.flat(), ...board.bench].find((p) => p.id === playerId) ??
    null
  );
}

/** Team index from a container id, or -1 for the bench and anything unknown. */
function teamIndexOf(container: string | null): number {
  if (!container || !container.startsWith("team-")) return -1;
  const index = Number(container.slice("team-".length));
  return Number.isInteger(index) ? index : -1;
}

/**
 * Relocates one player to a team or the bench.
 *
 * Deliberately *not* a swap: it changes team sizes, because making the sides
 * uneven on purpose is a real thing to want — four on five, or sending someone
 * to sit. `swap` is the operation that keeps sizes fixed.
 */
export function move(board: Board, playerId: string, to: string): Board {
  const from = findContainer(board, playerId);
  if (!from || from === to) return board;

  const player = findPlayer(board, playerId);
  if (!player) return board;

  const strip = (list: BalancePlayer[]) =>
    list.filter((p) => p.id !== playerId);
  const teams = board.teams.map(strip);
  let bench = strip(board.bench);

  if (to === BENCH) {
    bench = [...bench, player];
  } else {
    const index = teamIndexOf(to);
    if (index === -1 || !teams[index]) return board;
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
export function pinToSpot(
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

/**
 * Trades two players between different sides, or between a side and the bench.
 *
 * The operation `move` cannot express. Moving Joe to the other team leaves that
 * team a man up and his own a man down; a swap sends someone back the other
 * way, so both rosters keep the size they had. That is what people mean on a
 * court by "switch" — not "go over there".
 *
 * Both ends are pinned afterwards, which keeps the guarantee `pinToSpot`
 * already makes: one swap moves exactly two people, and nothing else on the
 * board re-derives underneath it. Two players on the same side is not a swap
 * of this kind — that is rearranging one lineup, which `pinToSpot` does.
 */
export function swap(
  board: Board,
  config: SportConfig,
  aId: string,
  bId: string,
): Board {
  if (aId === bId) return board;

  const fromA = findContainer(board, aId);
  const fromB = findContainer(board, bId);
  if (!fromA || !fromB || fromA === fromB) return board;

  const a = findPlayer(board, aId);
  const b = findPlayer(board, bId);
  if (!a || !b) return board;

  // Read the whole board as it stands, before anything moves.
  const matchups = buildMatchups(config, board.teams, board.pinned);
  const indexA = teamIndexOf(fromA);
  const indexB = teamIndexOf(fromB);
  const spotAt = (teamIndex: number, playerId: string) =>
    teamIndex === -1
      ? null
      : (matchups.find((m) => m.players[teamIndex]?.id === playerId)
          ?.position ?? null);
  const spotA = spotAt(indexA, aId);
  const spotB = spotAt(indexB, bId);

  const substitute = (list: BalancePlayer[]) =>
    list
      .map((p) => (p.id === aId ? b : p.id === bId ? a : p))
      .sort((x, y) => y.overall - x.overall);

  const teams = board.teams.map(substitute);
  // The bench is a queue rather than a ranking - whoever has waited longest
  // comes on first - so a substitution there keeps its position in line.
  const bench = board.bench.map((p) =>
    p.id === aId ? b : p.id === bId ? a : p,
  );

  /*
   * Each player inherits the spot the other was standing on. Spot keys are
   * shared across sides — both teams have a point guard — so this is a
   * straight exchange rather than a translation.
   *
   * A player coming off the bench has no spot to give, so whoever goes the
   * other way loses their pin: there are no spots on the bench to hold one,
   * and a stale pin would place them the moment they came back on.
   */
  const pinned = { ...board.pinned };

  /*
   * Freeze both lineups before applying the trade.
   *
   * Pinning only the two who moved is not enough. Automatic placement runs over
   * whoever is left unpinned, and a swap changes what each side is made of - so
   * the height pass re-derives and players who had nothing to do with it slide
   * between spots. Swapping a point guard out was enough to send two team-mates
   * from centre to point and back, which reads as the app doing something you
   * did not ask for.
   *
   * The rule this keeps is the one a drag already promises: one swap moves
   * exactly two people. Everyone else stays where they were standing, so the
   * only change on screen is the one that was asked for.
   */
  for (const teamIndex of [indexA, indexB]) {
    if (teamIndex === -1) continue;
    for (const m of matchups) {
      const occupant = m.players[teamIndex];
      if (occupant) pinned[occupant.id] = m.position;
    }
  }

  delete pinned[aId];
  delete pinned[bId];
  if (spotB !== null) pinned[aId] = spotB;
  if (spotA !== null) pinned[bId] = spotA;

  return { teams, bench, pinned };
}
