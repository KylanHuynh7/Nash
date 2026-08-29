/**
 * Who has been comped, and what the group said. Reads, never writes.
 *
 * A comp is a label, not a rating — nothing here proposes a number and no fit
 * consumes it.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/comp-status.mts basketball
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { comps, players, profiles } from "../db/schema";
import { SPORTS, isSportId } from "../lib/sports";
import { verdict } from "../lib/comps";

const sport = process.argv[2];
if (!sport || !isSportId(sport)) {
  console.error(`usage: comp-status.mts <${Object.keys(SPORTS).join("|")}>`);
  process.exit(1);
}

const db = getDb();

const roster = await db
  .select({ id: players.id, name: players.name })
  .from(profiles)
  .innerJoin(players, eq(players.id, profiles.playerId))
  .where(eq(profiles.sport, sport))
  .orderBy(asc(players.name));

const rows = await db
  .select({
    raterId: comps.raterId,
    subjectId: comps.subjectId,
    comp: comps.comp,
  })
  .from(comps)
  .where(eq(comps.sport, sport));

if (rows.length === 0) {
  console.log(`\nNo ${sport} comps yet. The block is the last part of the round.\n`);
  process.exit(0);
}

const raters = new Set(rows.map((r) => r.raterId));
const byName = new Map(roster.map((p) => [p.id, p.name]));
const width = Math.max(...roster.map((p) => p.name.length));

console.log(
  `\n${SPORTS[sport].label} — ${rows.length} comp(s) from ${raters.size} rater(s)\n`,
);

for (const person of roster) {
  const votes = rows.filter((r) => r.subjectId === person.id);
  const v = verdict(votes);
  const detail = v.all.map((a) => `${a.comp} x${a.votes}`).join(", ");
  const skips = votes.filter((r) => r.comp === null).length;
  console.log(
    `  ${person.name.padEnd(width)}  ` +
      (v.comp
        ? `${v.comp} (${v.votes}/${v.answers})`
        : votes.length === 0
          ? "— nobody asked yet —"
          : `no verdict yet (${v.answers} answered)`),
  );
  if (detail) console.log(`      ${detail}${skips ? `, ${skips} skipped` : ""}`);
}

console.log(
  `\n  Two agreeing is the bar. A tie at the top is not a verdict —` +
    `\n  it is the group being split, and picking one would invent a consensus.\n`,
);
