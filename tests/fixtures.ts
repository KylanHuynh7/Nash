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

/*
 * Split 2026-08-29: athleticism -> speed/strength/stamina, defense ->
 * perimeter_d/interior_d. Each child was seeded at its parent's value, so the
 * three physicals and the two defensive numbers still agree here. They will
 * separate as the collected axes land, and these fixtures should be
 * regenerated from the database when they do rather than hand-edited.
 */
const BASKETBALL: Row[] = [
  { name: "Taha", h: 74, position: "pg", overall: 96, ratings: { speed: 99, strength: 99, stamina: 99, finishing: 96, rebounding: 88, perimeter_d: 97, interior_d: 97, shooting: 95, playmaking: 99 } },
  { name: "Brendan", h: 70, position: "sg", overall: 91, ratings: { speed: 96, strength: 96, stamina: 96, finishing: 93, rebounding: 78, perimeter_d: 95, interior_d: 95, shooting: 93, playmaking: 90 } },
  { name: "Orion", h: 70, position: "sf", overall: 90, ratings: { speed: 96, strength: 96, stamina: 96, finishing: 94, rebounding: 82, perimeter_d: 88, interior_d: 88, shooting: 93, playmaking: 85 } },
  { name: "Victor", h: 71, position: "pg", overall: 85, ratings: { speed: 84, strength: 84, stamina: 84, finishing: 84, rebounding: 79, perimeter_d: 87, interior_d: 87, shooting: 87, playmaking: 88 } },
  { name: "Joe", h: 72, position: "sf", overall: 85, ratings: { speed: 76, strength: 76, stamina: 76, finishing: 88, rebounding: 82, perimeter_d: 92, interior_d: 92, shooting: 90, playmaking: 82 } },
  { name: "Eric", h: 65, position: "pg", overall: 82, ratings: { speed: 90, strength: 90, stamina: 90, finishing: 90, rebounding: 66, perimeter_d: 72, interior_d: 72, shooting: 88, playmaking: 86 } },
  { name: "Kylan", h: 70, position: "pf", overall: 81, ratings: { speed: 83, strength: 83, stamina: 83, finishing: 79, rebounding: 89, perimeter_d: 81, interior_d: 81, shooting: 71, playmaking: 81 } },
  { name: "David", h: 66, position: "sg", overall: 81, ratings: { speed: 80, strength: 80, stamina: 80, finishing: 78, rebounding: 70, perimeter_d: 94, interior_d: 94, shooting: 82, playmaking: 80 } },
  { name: "Jason", h: 73, position: "c", overall: 81, ratings: { speed: 70, strength: 70, stamina: 70, finishing: 80, rebounding: 91, perimeter_d: 82, interior_d: 82, shooting: 85, playmaking: 80 } },
  { name: "Bang", h: 70, position: "sg", overall: 79, ratings: { speed: 75, strength: 75, stamina: 75, finishing: 93, rebounding: 65, perimeter_d: 65, interior_d: 65, shooting: 92, playmaking: 87 } },
  { name: "Lucas", h: 70, position: "sf", overall: 76, ratings: { speed: 83, strength: 83, stamina: 83, finishing: 76, rebounding: 72, perimeter_d: 72, interior_d: 72, shooting: 78, playmaking: 74 } },
  { name: "Rayan", h: 69, position: "sf", overall: 74, ratings: { speed: 86, strength: 86, stamina: 86, finishing: 70, rebounding: 78, perimeter_d: 72, interior_d: 72, shooting: 69, playmaking: 67 } },
  { name: "Danny", h: 66, position: "pg", overall: 71, ratings: { speed: 78, strength: 78, stamina: 78, finishing: 68, rebounding: 65, perimeter_d: 70, interior_d: 70, shooting: 76, playmaking: 66 } },
  { name: "Brian", h: 65, position: "pg", overall: 70, ratings: { speed: 80, strength: 80, stamina: 80, finishing: 70, rebounding: 65, perimeter_d: 66, interior_d: 66, shooting: 72, playmaking: 67 } },
  { name: "Sean", h: 70, position: "pf", overall: 67, ratings: { speed: 68, strength: 68, stamina: 68, finishing: 66, rebounding: 67, perimeter_d: 67, interior_d: 67, shooting: 68, playmaking: 65 } },
  { name: "Alfonso", h: 68, position: "sf", overall: 66, ratings: { speed: 65, strength: 65, stamina: 65, finishing: 67, rebounding: 65, perimeter_d: 66, interior_d: 66, shooting: 68, playmaking: 65 } },
  { name: "Justin", h: 69, position: "sf", overall: 65, ratings: { speed: 66, strength: 66, stamina: 66, finishing: 65, rebounding: 65, perimeter_d: 65, interior_d: 65, shooting: 65, playmaking: 65 } },
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
