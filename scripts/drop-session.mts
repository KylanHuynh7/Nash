/**
 * Deletes one sitting's worth of comparisons.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/drop-session.mts <sessionId>
 *
 * `session_id` exists so a bad sitting can be removed without discarding that
 * rater's earlier, more considered answers — someone who rushed the last twenty,
 * or a run-through that was really a demo. This is the tool for that.
 *
 * Scoped to one session on purpose. There is deliberately no "delete all":
 * every environment shares one DATABASE_URL, so an unscoped delete here is a
 * delete in production.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { comparisons, players } from "../db/schema";

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("usage: drop-session.mts <sessionId>");
  process.exit(1);
}

const db = getDb();
const names = new Map(
  (await db.select().from(players)).map((p) => [p.id, p.name]),
);

const doomed = await db
  .select()
  .from(comparisons)
  .where(eq(comparisons.sessionId, sessionId));

if (doomed.length === 0) {
  console.log(`No comparisons in session ${sessionId}. Nothing to do.`);
  process.exit(0);
}

console.log(`Session ${sessionId} — ${doomed.length} comparison(s):`);
for (const r of doomed) {
  console.log(
    `  rater=${names.get(r.raterId)}  ${names.get(r.leftId)} vs ${names.get(
      r.rightId,
    )} -> ${r.winnerId ? names.get(r.winnerId) : "(too close)"}`,
  );
}

await db.delete(comparisons).where(eq(comparisons.sessionId, sessionId));

const left = await db.select().from(comparisons);
console.log(`\nDeleted. ${left.length} comparison(s) remain in the table.`);
