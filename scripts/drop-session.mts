/**
 * Deletes one sitting's worth of comparisons.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/drop-session.mts <sessionId>
 *   npx dotenv -e .env.local -- npx tsx scripts/drop-session.mts <sessionId> --axis strength
 *
 * `session_id` exists so a bad sitting can be removed without discarding that
 * rater's earlier, more considered answers — someone who rushed the last twenty,
 * or a run-through that was really a demo. This is the tool for that.
 *
 * `--axis` narrows it further, to one block of a multi-axis round. That case is
 * real: a rater can understand the stamina questions perfectly and then
 * misread the strength ones, and throwing away their whole sitting to fix one
 * block would discard good answers to make a point.
 *
 * Scoped to one session on purpose. There is deliberately no "delete all":
 * every environment shares one DATABASE_URL, so an unscoped delete here is a
 * delete in production.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { comparisons, players } from "../db/schema";

const sessionId = process.argv[2];
if (!sessionId || sessionId.startsWith("--")) {
  console.error("usage: drop-session.mts <sessionId> [--axis KEY]");
  process.exit(1);
}
const axisAt = process.argv.indexOf("--axis");
const axis = axisAt === -1 ? undefined : process.argv[axisAt + 1];
if (axisAt !== -1 && !axis) {
  console.error("--axis needs a key");
  process.exit(1);
}
const scope = axis
  ? and(eq(comparisons.sessionId, sessionId), eq(comparisons.axis, axis))
  : eq(comparisons.sessionId, sessionId);

const db = getDb();
const names = new Map(
  (await db.select().from(players)).map((p) => [p.id, p.name]),
);

const doomed = await db.select().from(comparisons).where(scope);

if (doomed.length === 0) {
  console.log(
    `No comparisons in session ${sessionId}${axis ? ` on axis ${axis}` : ""}. Nothing to do.`,
  );
  process.exit(0);
}

console.log(
  `Session ${sessionId}${axis ? ` / ${axis}` : ""} — ${doomed.length} comparison(s):`,
);
for (const r of doomed) {
  console.log(
    `  rater=${names.get(r.raterId)}  ${names.get(r.leftId)} vs ${names.get(
      r.rightId,
    )} -> ${r.winnerId ? names.get(r.winnerId) : "(too close)"}`,
  );
}

await db.delete(comparisons).where(scope);

const left = await db.select().from(comparisons);
console.log(`\nDeleted. ${left.length} comparison(s) remain in the table.`);
