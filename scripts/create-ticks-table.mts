/**
 * Creates the `ticks` table.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/create-ticks-table.mts
 *
 * Written as explicit additive DDL rather than run through `drizzle-kit push`
 * because push diffs the whole schema and is free to drop things. Every
 * environment shares one DATABASE_URL, so this is production: `CREATE TABLE IF
 * NOT EXISTS` is the whole change, it is idempotent, and it cannot touch a row
 * that already exists.
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";

const db = getDb();

await db.execute(sql`
  CREATE TABLE IF NOT EXISTS ticks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sport text NOT NULL,
    axis text NOT NULL,
    rater_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    session_id text NOT NULL,
    subject_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    ticked integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )
`);
await db.execute(sql`
  CREATE UNIQUE INDEX IF NOT EXISTS ticks_rater_subject_unique
    ON ticks (rater_id, sport, axis, subject_id)
`);
await db.execute(sql`
  CREATE INDEX IF NOT EXISTS ticks_sport_axis_idx ON ticks (sport, axis)
`);

const check = await db.execute(sql`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'ticks' ORDER BY ordinal_position
`);
console.log("  ticks table:");
for (const r of check.rows as { column_name: string; data_type: string }[]) {
  console.log(`    ${r.column_name.padEnd(12)} ${r.data_type}`);
}
