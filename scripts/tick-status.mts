/**
 * Who has answered which tick pass, and what they said.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/tick-status.mts basketball
 *
 * Reads, never writes — the tick equivalent of `round-status.mts`. Reports the
 * ticked count AND the pass count separately, because a pass with zero ticks is
 * a real answer (it says the attribute may be a constant) and has to be
 * distinguishable from a pass nobody opened.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { players, ticks } from "../db/schema";
import { SPORTS, isSportId } from "../lib/sports";

const sport = process.argv[2] ?? "basketball";
if (!isSportId(sport)) {
  console.error(`Unknown sport: ${sport}`);
  process.exit(1);
}

const db = getDb();
const rows = await db
  .select({
    axis: ticks.axis,
    ticked: ticks.ticked,
    raterId: ticks.raterId,
    subjectId: ticks.subjectId,
  })
  .from(ticks)
  .where(eq(ticks.sport, sport));

const names = new Map(
  (await db.select({ id: players.id, name: players.name }).from(players)).map(
    (p) => [p.id, p.name],
  ),
);

const tickAxes = SPORTS[sport].axes.filter((a) => a.mode === "tick");
if (rows.length === 0) {
  console.log(`\n  No tick passes recorded for ${sport}.\n`);
  process.exit(0);
}

console.log(`\n${SPORTS[sport].label} — tick passes\n`);
for (const axis of tickAxes) {
  const mine = rows.filter((r) => r.axis === axis.key);
  const raters = new Set(mine.map((r) => r.raterId));
  const counts = new Map<string, number>();
  for (const r of mine) {
    if (r.ticked === 1)
      counts.set(r.subjectId, (counts.get(r.subjectId) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(
    `  ${axis.label.padEnd(14)} ${raters.size} pass(es), ${mine.length} rows`,
  );
  if (raters.size === 0) {
    // Not the same finding as an answered pass with no ticks, and saying so
    // would invent evidence that an attribute is a constant.
    console.log("    not answered yet");
  } else if (ranked.length === 0) {
    console.log("    answered, nobody ticked — may be a constant");
  } else {
    for (const [id, n] of ranked) {
      console.log(`    ${(names.get(id) ?? id).padEnd(10)} ${n}/${raters.size}`);
    }
  }
}
console.log();
