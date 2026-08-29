/**
 * Delete one rater's NBA comps.
 *
 * Scoped to one rater for the same reason drop-ticks.mts and drop-session.mts
 * are: every environment shares one DATABASE_URL, so a delete here is a delete
 * in production. There is no "delete all" by design. Dry by default.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/drop-comps.mts Kylan
 *   npx dotenv -e .env.local -- npx tsx scripts/drop-comps.mts Kylan --apply
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { comps, players } from "../db/schema";
import { SPORTS, isSportId } from "../lib/sports";

const [name, ...flags] = process.argv.slice(2);
const apply = flags.includes("--apply");
const sportArg = flags.find((f) => !f.startsWith("--")) ?? "basketball";

if (!name || !isSportId(sportArg)) {
  console.error(
    `usage: drop-comps.mts <rater> [<${Object.keys(SPORTS).join("|")}>] [--apply]`,
  );
  process.exit(1);
}

const db = getDb();
const [rater] = await db
  .select({ id: players.id, name: players.name })
  .from(players)
  .where(sql`lower(${players.name}) = ${name.toLowerCase()}`)
  .limit(1);

if (!rater) {
  console.error(`No player named "${name}".`);
  process.exit(1);
}

const rows = await db
  .select({ comp: comps.comp })
  .from(comps)
  .where(and(eq(comps.sport, sportArg), eq(comps.raterId, rater.id)));

if (rows.length === 0) {
  console.log(`\n${rater.name} has no ${sportArg} comps.\n`);
  process.exit(0);
}

console.log(`\n  ${rater.name} — ${rows.length} ${sportArg} comp(s)`);
console.log(
  `  ${rows.map((r) => r.comp ?? "(skipped)").join(", ")}\n`,
);

if (!apply) {
  console.log("  Dry run. Re-run with --apply to delete them.\n");
  process.exit(0);
}

await db
  .delete(comps)
  .where(and(eq(comps.sport, sportArg), eq(comps.raterId, rater.id)));
console.log("  Deleted.\n");
