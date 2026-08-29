/**
 * Delete one rater's tick pass on one axis.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/drop-ticks.mts <rater> <axis>
 *
 * Prints what it will remove before removing it, and is scoped to one rater on
 * one axis on purpose. There is no "delete all" here for the same reason
 * `drop-session.mts` has none: every environment shares one DATABASE_URL, so a
 * delete here is a delete in production.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { players, ticks } from "../db/schema";

const [raterName, axis] = process.argv.slice(2);
if (!raterName || !axis) {
  console.error("Usage: drop-ticks.mts <rater> <axis>");
  process.exit(1);
}

const db = getDb();
const rater = (
  await db.select({ id: players.id, name: players.name }).from(players)
).find((p) => p.name.toLowerCase() === raterName.toLowerCase());
if (!rater) {
  console.error(`No player named ${raterName}`);
  process.exit(1);
}

const rows = await db
  .select({ ticked: ticks.ticked, subjectId: ticks.subjectId })
  .from(ticks)
  .where(and(eq(ticks.raterId, rater.id), eq(ticks.axis, axis)));

if (rows.length === 0) {
  console.log(`\n  ${rater.name} has no ${axis} pass. Nothing to do.\n`);
  process.exit(0);
}

console.log(
  `\n  Removing ${rater.name}'s ${axis} pass: ${rows.length} rows, ${rows.filter((r) => r.ticked === 1).length} ticked.`,
);
if (!process.argv.includes("--apply")) {
  console.log("  Dry run. Re-run with --apply to delete.\n");
  process.exit(0);
}
await db
  .delete(ticks)
  .where(and(eq(ticks.raterId, rater.id), eq(ticks.axis, axis)));
console.log("  Deleted.\n");
