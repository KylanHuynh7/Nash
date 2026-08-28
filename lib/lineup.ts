/**
 * Where each player stands, derived from a team list. Pure logic, kept out of
 * the court component so a server component — the share page — can lay out the
 * same matchups without pulling a client bundle in with it.
 */
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

    /*
     * Attribute-claimed spots go first, and to the best on this team.
     *
     * Quarterback is the case: nobody holds it as a position, so no amount of
     * position matching would ever fill it. It has to be resolved by asking
     * who throws best — the same question the team would ask — and it has to
     * happen before position matching, or the arm has already been placed out
     * wide and the spot is filled by whoever was left.
     */
    const takenByAttribute = new Set<string>();
    slots.forEach((slot, i) => {
      const attribute = config.spots[i].byAttribute;
      if (!attribute || slot.players[teamIndex] !== null) return;
      let best: BalancePlayer | null = null;
      let bestValue = -Infinity;
      for (const player of automatic) {
        if (takenByAttribute.has(player.id)) continue;
        const value = player.ratings?.[attribute];
        if (typeof value !== "number" || value <= bestValue) continue;
        best = player;
        bestValue = value;
      }
      if (best) {
        slot.players[teamIndex] = best;
        takenByAttribute.add(best.id);
      }
    });

    for (const player of automatic) {
      if (takenByAttribute.has(player.id)) continue;
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
