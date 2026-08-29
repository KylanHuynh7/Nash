/**
 * Verify every pool axis's frozen slate resolves against the live roster.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/check-pools.mts basketball
 *
 * A slate is a hand-written list of names in `lib/sports.ts`. The bootstrap
 * drops unmatched names rather than throwing — right for uptime, wrong for
 * finding a typo — so this is the thing that actually catches one.
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { players, profiles } from "../db/schema";
import { SPORTS, isSportId } from "../lib/sports";
import { blockTargets } from "../lib/compare";

const sport = process.argv[2] ?? "basketball";
if (!isSportId(sport)) process.exit(1);

const db = getDb();
const roster = new Set(
  (
    await db
      .select({ name: players.name })
      .from(profiles)
      .innerJoin(players, eq(players.id, profiles.playerId))
      .where(eq(profiles.sport, sport))
      .orderBy(asc(players.name))
  ).map((r) => r.name),
);

const round = SPORTS[sport].axes.filter((a) => a.collect);
const targets = blockTargets(round, roster.size);
let bad = 0;
let total = 0;

console.log(`\n${SPORTS[sport].label} — round of ${round.length} blocks\n`);
console.log("  block             target  slate  unmatched");
round.forEach((a, i) => {
  total += targets[i];
  const missing = (a.poolNames ?? []).filter((n) => !roster.has(n));
  if (missing.length) bad++;
  console.log(
    `  ${a.label.padEnd(16)} ${String(targets[i]).padStart(6)} ${String(a.poolNames?.length ?? roster.size).padStart(6)}  ${missing.join(", ") || "-"}`,
  );
});
console.log(
  `\n  ${total} questions for a fresh rater, about ${(total * 4 / 60).toFixed(1)} minutes.`,
);
if (bad > 0) {
  console.error(`\n  ${bad} slate(s) name someone not on the roster.\n`);
  process.exit(1);
}
console.log("  Every slate resolves.\n");
