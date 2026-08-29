/**
 * Create the `comps` table.
 *
 * Explicit additive DDL rather than `drizzle-kit push`, for the reason the
 * ticks migration states: push diffs the whole schema and is free to drop
 * things, and every environment shares one DATABASE_URL. Idempotent.
 *
 * Run this BEFORE deploying the code that reads it. The standing "deploy
 * first, then migrate" rule is about changing a shape running code already
 * reads; a brand-new table is the opposite case.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/create-comps-table.mts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { comps } from "../db/schema";

const db = getDb();

await db.execute(sql`
  create table if not exists comps (
    id uuid primary key default gen_random_uuid(),
    sport text not null,
    rater_id uuid not null references players(id) on delete cascade,
    session_id text not null,
    subject_id uuid not null references players(id) on delete cascade,
    comp text,
    created_at timestamptz not null default now()
  )
`);
await db.execute(sql`
  create unique index if not exists comps_rater_subject_unique
    on comps (rater_id, sport, subject_id)
`);
await db.execute(sql`create index if not exists comps_sport_idx on comps (sport)`);

const rows = await db.select({ id: comps.id }).from(comps);
console.log(`comps table ready — ${rows.length} recorded comp(s).`);
