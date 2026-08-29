/**
 * Create the `games` table.
 *
 * Explicit additive DDL rather than `drizzle-kit push`, for the reason the
 * ticks migration states: push diffs the whole schema and is free to drop
 * things, and every environment shares one DATABASE_URL. Idempotent.
 *
 * Ordering note. The standing rule is "deploy the code first, then migrate",
 * which is about a migration that changes a shape running code already reads.
 * This adds a table nothing reads yet, so the safe order is the reverse: create
 * it first, then deploy the code that reads it. Deploying first would ship a
 * server action querying a table that does not exist.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/create-games-table.mts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { games } from "../db/schema";

const db = getDb();

await db.execute(sql`
  create table if not exists games (
    id uuid primary key default gen_random_uuid(),
    sport text not null,
    teams jsonb not null,
    winner integer not null,
    predicted_spread integer not null default 0,
    played_at timestamptz not null default now(),
    created_at timestamptz not null default now()
  )
`);
await db.execute(sql`create index if not exists games_sport_idx on games (sport)`);

const rows = await db.select({ id: games.id }).from(games);
console.log(`games table ready — ${rows.length} recorded game(s).`);
