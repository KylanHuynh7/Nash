/**
 * Who has answered what, for the round currently being collected.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/round-status.mts basketball
 *
 * The question this answers is "has anyone done it yet", which is the only
 * thing worth knowing between sending links and having data. It reads; it
 * never writes.
 *
 * Per axis rather than per person alone, because a multi-axis round can be
 * half-finished in a way a total would hide: someone who answered every
 * stamina question and stopped looks identical to someone who spread the same
 * count across three blocks.
 */
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db";
import { comparisons, players } from "../db/schema";
import { SPORTS, isSportId } from "../lib/sports";
import { blockTargets } from "../lib/compare";

const sport = process.argv[2];
if (!sport || !isSportId(sport)) {
  console.error(`usage: round-status.mts <${Object.keys(SPORTS).join("|")}>`);
  process.exit(1);
}

const config = SPORTS[sport];
const round = config.axes.filter((a) => a.collect);
if (round.length === 0) {
  console.log(`${config.label} has no axes flagged for collection.`);
  process.exit(0);
}

const db = getDb();
const rows = await db
  .select({
    name: players.name,
    axis: comparisons.axis,
    sessionId: comparisons.sessionId,
    createdAt: comparisons.createdAt,
  })
  .from(comparisons)
  .innerJoin(players, eq(players.id, comparisons.raterId))
  .where(and(eq(comparisons.sport, sport), ne(comparisons.axis, "overall")));

const keys = round.map((a) => a.key);

// Block targets depend on how many pairs a rater has, so on the pool size.
const poolSize = (
  await db.select({ n: players.name }).from(players)
).length;
const perBlock = blockTargets(round.length, poolSize);

const byPerson = new Map<string, Map<string, number>>();
const sittings = new Map<string, Set<string>>();
const lastSeen = new Map<string, Date>();
for (const row of rows) {
  if (!keys.includes(row.axis)) continue;
  const counts = byPerson.get(row.name) ?? new Map<string, number>();
  counts.set(row.axis, (counts.get(row.axis) ?? 0) + 1);
  byPerson.set(row.name, counts);
  const s = sittings.get(row.name) ?? new Set<string>();
  s.add(row.sessionId);
  sittings.set(row.name, s);
  const at = new Date(row.createdAt);
  if (!lastSeen.has(row.name) || at > lastSeen.get(row.name)!) {
    lastSeen.set(row.name, at);
  }
}

const roundTotal = perBlock.reduce((a, b) => a + b, 0);
console.log(`\n${config.label} — ${round.length} part(s), ${roundTotal} questions\n`);
console.log(`  ${"rater".padEnd(10)} ${round.map((a) => a.label.slice(0, 10).padStart(11)).join("")}   total`);

if (byPerson.size === 0) {
  console.log("\n  Nobody has answered yet.\n");
  process.exit(0);
}

for (const [name, counts] of [...byPerson].sort(
  (a, b) =>
    [...b[1].values()].reduce((x, y) => x + y, 0) -
    [...a[1].values()].reduce((x, y) => x + y, 0),
)) {
  const cells = round.map((a, i) => {
    const n = counts.get(a.key) ?? 0;
    const mark = n >= perBlock[i] ? "*" : " ";
    return `${n}/${perBlock[i]}${mark}`.padStart(11);
  });
  const total = [...counts.values()].reduce((x, y) => x + y, 0);
  console.log(
    `  ${name.padEnd(10)} ${cells.join("")}   ${String(total).padStart(3)}/${roundTotal}` +
      `  (${sittings.get(name)!.size} sitting, last ${lastSeen.get(name)!.toISOString().slice(5, 16).replace("T", " ")})`,
  );
}

console.log(`\n  * = part complete. ${byPerson.size} rater(s) have started.\n`);
