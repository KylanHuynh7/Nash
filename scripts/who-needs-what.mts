/**
 * Per person: what the round still owes, and how long it will take them.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/who-needs-what.mts basketball
 *
 * `round-status.mts` answers "who has answered what" for people who have
 * STARTED. This answers "who do I still need to chase", which includes
 * everybody who has not opened the link at all — the people missing from a
 * status table are exactly the ones worth a message.
 */
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db";
import { comparisons, players, profiles } from "../db/schema";
import { SPORTS, isSportId } from "../lib/sports";
import { blockTargets } from "../lib/compare";

const sport = process.argv[2] ?? "basketball";
if (!isSportId(sport)) process.exit(1);

const db = getDb();
const roster = await db
  .select({ id: players.id, name: players.name, token: players.raterToken })
  .from(profiles)
  .innerJoin(players, eq(players.id, profiles.playerId))
  .where(eq(profiles.sport, sport));

const rows = await db
  .select({ raterId: comparisons.raterId, axis: comparisons.axis })
  .from(comparisons)
  .where(and(eq(comparisons.sport, sport), ne(comparisons.axis, "overall")));

const round = SPORTS[sport].axes.filter((a) => a.collect);
const targets = blockTargets(round, roster.length);
const total = targets.reduce((a, b) => a + b, 0);

const done = new Map<string, Map<string, number>>();
for (const r of rows) {
  if (!done.has(r.raterId)) done.set(r.raterId, new Map());
  const m = done.get(r.raterId)!;
  m.set(r.axis, (m.get(r.axis) ?? 0) + 1);
}

type Line = { name: string; left: number; blocks: string[]; token: string | null };
const lines: Line[] = roster.map((p) => {
  const m = done.get(p.id) ?? new Map<string, number>();
  let left = 0;
  const blocks: string[] = [];
  round.forEach((a, i) => {
    const short = Math.max(0, targets[i] - (m.get(a.key) ?? 0));
    left += short;
    if (short > 0) blocks.push(a.label);
  });
  return { name: p.name, left, blocks, token: p.token };
});

lines.sort((a, b) => a.left - b.left || a.name.localeCompare(b.name));

console.log(`\n${SPORTS[sport].label} — round of ${total} questions\n`);
for (const l of lines) {
  if (l.left === 0) {
    console.log(`  ${l.name.padEnd(9)} DONE`);
    continue;
  }
  const mins = (l.left * 4) / 60;
  const tag = l.left === total ? "everything" : l.blocks.join(", ");
  console.log(
    `  ${l.name.padEnd(9)} ${String(l.left).padStart(3)} left  ~${mins.toFixed(0)}m   ${tag}`,
  );
}
console.log(`\n  Nobody needs a new link — the URL is per person and permanent.\n`);
