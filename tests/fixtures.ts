/**
 * The real seventeen, pulled from the database rather than retyped.
 *
 * Tests that assert measured claims - "the balancer splits this pool with zero
 * spread" - are only worth something against the pool the claim was measured
 * on. A synthetic roster of round numbers would pass while telling you nothing
 * about the app.
 */
import type { BalancePlayer } from "@/lib/balance";

type Row = {
  name: string;
  h: number;
  position: string;
  ratings: Record<string, number>;
  overall: number;
};

const BASKETBALL: Row[] = [
  { name: "Taha", h: 74, position: "pg", overall: 96, ratings: { defense: 97, shooting: 95, finishing: 96, playmaking: 99, rebounding: 88, athleticism: 99 } },
  { name: "Brendan", h: 70, position: "sg", overall: 91, ratings: { defense: 95, shooting: 93, finishing: 93, playmaking: 90, rebounding: 78, athleticism: 96 } },
  { name: "Orion", h: 70, position: "sf", overall: 90, ratings: { defense: 88, shooting: 93, finishing: 94, playmaking: 85, rebounding: 82, athleticism: 96 } },
  { name: "Joe", h: 72, position: "sf", overall: 85, ratings: { defense: 92, shooting: 90, finishing: 88, playmaking: 82, rebounding: 82, athleticism: 76 } },
  { name: "Victor", h: 71, position: "pg", overall: 85, ratings: { defense: 87, shooting: 87, finishing: 84, playmaking: 88, rebounding: 79, athleticism: 84 } },
  { name: "Eric", h: 65, position: "pg", overall: 82, ratings: { defense: 72, shooting: 88, finishing: 90, playmaking: 86, rebounding: 66, athleticism: 90 } },
  { name: "Kylan", h: 70, position: "pf", overall: 81, ratings: { defense: 81, shooting: 71, finishing: 79, playmaking: 81, rebounding: 89, athleticism: 83 } },
  { name: "David", h: 66, position: "sg", overall: 81, ratings: { defense: 94, shooting: 82, finishing: 78, playmaking: 80, rebounding: 70, athleticism: 80 } },
  { name: "Jason", h: 73, position: "c", overall: 81, ratings: { defense: 82, shooting: 85, finishing: 80, playmaking: 80, rebounding: 91, athleticism: 70 } },
  { name: "Bang", h: 70, position: "sg", overall: 79, ratings: { defense: 65, shooting: 92, finishing: 93, playmaking: 87, rebounding: 65, athleticism: 75 } },
  { name: "Lucas", h: 70, position: "sf", overall: 76, ratings: { defense: 72, shooting: 78, finishing: 76, playmaking: 74, rebounding: 72, athleticism: 83 } },
  { name: "Rayan", h: 69, position: "sf", overall: 74, ratings: { defense: 72, shooting: 69, finishing: 70, playmaking: 67, rebounding: 78, athleticism: 86 } },
  { name: "Danny", h: 66, position: "pg", overall: 71, ratings: { defense: 70, shooting: 76, finishing: 68, playmaking: 66, rebounding: 65, athleticism: 78 } },
  { name: "Brian", h: 65, position: "pg", overall: 70, ratings: { defense: 66, shooting: 72, finishing: 70, playmaking: 67, rebounding: 65, athleticism: 80 } },
  { name: "Sean", h: 70, position: "pf", overall: 67, ratings: { defense: 67, shooting: 68, finishing: 66, playmaking: 65, rebounding: 67, athleticism: 68 } },
  { name: "Alfonso", h: 68, position: "sf", overall: 66, ratings: { defense: 66, shooting: 68, finishing: 67, playmaking: 65, rebounding: 65, athleticism: 65 } },
  { name: "Justin", h: 69, position: "sf", overall: 65, ratings: { defense: 65, shooting: 65, finishing: 65, playmaking: 65, rebounding: 65, athleticism: 66 } },
];

const FOOTBALL: Row[] = [
  { name: "Orion", h: 70, position: "wr", overall: 88, ratings: { iq: 86, hands: 89, speed: 96, routes: 89, coverage: 88, throwing: 75 } },
  { name: "Victor", h: 71, position: "wr", overall: 84, ratings: { iq: 88, hands: 82, speed: 84, routes: 86, coverage: 87, throwing: 75 } },
  { name: "Joe", h: 72, position: "te", overall: 83, ratings: { iq: 86, hands: 86, speed: 76, routes: 80, coverage: 92, throwing: 75 } },
  { name: "Kylan", h: 70, position: "wr", overall: 81, ratings: { iq: 81, hands: 83, speed: 83, routes: 82, coverage: 81, throwing: 75 } },
  { name: "Jason", h: 73, position: "te", overall: 78, ratings: { iq: 81, hands: 84, speed: 70, routes: 76, coverage: 82, throwing: 75 } },
  { name: "Lucas", h: 70, position: "wr", overall: 76, ratings: { iq: 73, hands: 74, speed: 83, routes: 78, coverage: 72, throwing: 75 } },
  { name: "Rayan", h: 69, position: "wr", overall: 75, ratings: { iq: 69, hands: 73, speed: 86, routes: 75, coverage: 72, throwing: 75 } },
  { name: "Danny", h: 66, position: "slot", overall: 71, ratings: { iq: 68, hands: 67, speed: 78, routes: 71, coverage: 70, throwing: 75 } },
  { name: "Brian", h: 65, position: "wr", overall: 71, ratings: { iq: 67, hands: 68, speed: 80, routes: 72, coverage: 66, throwing: 75 } },
  { name: "Sean", h: 70, position: "te", overall: 68, ratings: { iq: 66, hands: 66, speed: 68, routes: 66, coverage: 67, throwing: 75 } },
  { name: "Alfonso", h: 68, position: "te", overall: 67, ratings: { iq: 65, hands: 66, speed: 65, routes: 65, coverage: 66, throwing: 75 } },
  { name: "Justin", h: 69, position: "slot", overall: 66, ratings: { iq: 65, hands: 65, speed: 66, routes: 65, coverage: 65, throwing: 75 } },
];

function toPlayers(rows: Row[]): BalancePlayer[] {
  return rows.map((r) => ({
    id: r.name.toLowerCase(),
    name: r.name,
    overall: r.overall,
    position: r.position,
    ratings: r.ratings,
    heightInches: r.h,
  }));
}

export const basketballPool = () => toPlayers(BASKETBALL);
export const footballPool = () => toPlayers(FOOTBALL);
export const basketballRows = BASKETBALL;

/** Look one player up by name, so tests read as names rather than indexes. */
export function byName(pool: BalancePlayer[], name: string): BalancePlayer {
  const found = pool.find((p) => p.name === name);
  if (!found) throw new Error(`no such player: ${name}`);
  return found;
}
