/**
 * Delete one recorded game.
 *
 * Scoped to a single id for the same reason drop-session.mts and drop-ticks.mts
 * are: every environment shares one DATABASE_URL, so a delete here is a delete
 * in production. There is no "delete all" by design. Prints what it will remove
 * before removing it, and needs --apply to actually do it.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/drop-game.mts <id>
 *   npx dotenv -e .env.local -- npx tsx scripts/drop-game.mts <id> --apply
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { games } from "../db/schema";

const [id, ...flags] = process.argv.slice(2);
const apply = flags.includes("--apply");

if (!id) {
  console.error("usage: drop-game.mts <id> [--apply]");
  process.exit(1);
}

const db = getDb();
const [row] = await db.select().from(games).where(eq(games.id, id)).limit(1);

if (!row) {
  console.error(`No game with id ${id}.`);
  process.exit(1);
}

const [a, b] = row.teams;
console.log(`\n  ${row.sport}  ${a.score}-${b.score}  ${String(row.playedAt).slice(4, 21)}`);
console.log(`  ${row.teams.map((t) => t.players.map((p) => p.name).join(" ")).join("  |  ")}\n`);

if (!apply) {
  console.log("  Dry run. Re-run with --apply to delete it.\n");
  process.exit(0);
}

await db.delete(games).where(eq(games.id, id));
console.log("  Deleted.\n");
