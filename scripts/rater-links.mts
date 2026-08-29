/**
 * Issues one comparison link per person and prints them for sending.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/rater-links.mts basketball
 *   npx dotenv -e .env.local -- npx tsx scripts/rater-links.mts basketball --axis stamina
 *   npx dotenv -e .env.local -- npx tsx scripts/rater-links.mts basketball --base http://192.168.12.176:3000
 *
 * ## Why one link each
 *
 * The collector used to be a single public link with a dropdown of names. Two
 * of the five raters in the 2026-08-28 collection answered a whole sitting
 * under someone else's name, and nothing in the data showed it — see
 * `lib/rater-token.ts`. A link per person removes the choice instead of
 * re-presenting it, which is the only version of this fix that works.
 *
 * **Send these individually.** Pasting the whole list into a group chat gives
 * everyone every link and puts the picker back, in a worse form. One DM each.
 *
 * **One link per person, not one per question.** A bare link runs the entire
 * round — every axis flagged `collect` — as sequential blocks inside a single
 * 80-question sitting.
 *
 * ## Idempotent on purpose
 *
 * Running it again reprints the same links rather than issuing new ones, so it
 * is safe to run whenever someone loses theirs. A token only ever changes if
 * `--rotate` is passed for a named person.
 *
 * The column is created here with explicit SQL rather than `drizzle-kit push`.
 * Every environment shares one DATABASE_URL, so a push against this database is
 * a push against production, and it has previously offered to truncate a table
 * to add a constraint that was already there.
 */
import { asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { players, profiles } from "../db/schema";
import { SESSION_TARGET } from "../lib/compare";
import { newRaterToken, raterPath } from "../lib/rater-token";
import { SPORTS, isSportId } from "../lib/sports";

const DEFAULT_BASE = "https://nash-teams.vercel.app";

const args = process.argv.slice(2);
const sport = args[0];
const base = (valueOf("--base") ?? DEFAULT_BASE).replace(/\/+$/, "");
const rotate = valueOf("--rotate");
const axisKey = valueOf("--axis");

function valueOf(flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

if (!sport || !isSportId(sport)) {
  console.error(
    `usage: rater-links.mts <${Object.keys(SPORTS).join("|")}> [--axis KEY] [--base URL] [--rotate NAME]`,
  );
  process.exit(1);
}

/*
 * What these links ask.
 *
 * By default: nothing. A link with no `axis` runs the whole current round —
 * every axis flagged `collect` — because friends get **one** link, not one per
 * attribute. Three links is how a round ends up with the third one never
 * opened.
 *
 * `--axis KEY` pins one, which is what a re-send of a single block needs.
 */
const round = axisKey
  ? SPORTS[sport].axes.filter((a) => a.key === axisKey)
  : SPORTS[sport].axes.filter((a) => a.collect);

if (round.length === 0) {
  console.error(
    axisKey
      ? `Unknown axis "${axisKey}" for ${sport}. Configured: ${SPORTS[sport].axes.map((a) => a.key).join(", ")}`
      : `${sport} has no axes flagged for collection. Set \`collect: true\` on the ones this round is for.`,
  );
  process.exit(1);
}

const db = getDb();

// `IF NOT EXISTS` on both, so this is the migration and it runs every time.
await db.execute(
  sql`alter table players add column if not exists rater_token text`,
);
await db.execute(
  sql`create unique index if not exists players_rater_token_unique on players (rater_token)`,
);

if (rotate) {
  const [target] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.name, rotate))
    .limit(1);
  if (!target) {
    console.error(`No player named ${rotate}.`);
    process.exit(1);
  }
  await db
    .update(players)
    .set({ raterToken: newRaterToken() })
    .where(eq(players.id, target.id));
  // Worth saying plainly: the old link stops working, and anything already
  // answered under it stays exactly where it is. The token names the rater, it
  // does not own their rows.
  console.log(`Rotated ${target.name}. Their previous link no longer works.\n`);
}

// Issued one at a time rather than in a single statement, because the unique
// index means a collision has to be retried individually. At 31^10 that will
// not happen; handling it costs nothing and pretending otherwise costs a
// confusing crash years from now.
const missing = await db
  .select({ id: players.id, name: players.name })
  .from(players)
  .where(isNull(players.raterToken));

for (const person of missing) {
  for (let attempt = 0; ; attempt++) {
    try {
      await db
        .update(players)
        .set({ raterToken: newRaterToken() })
        .where(eq(players.id, person.id));
      break;
    } catch (error) {
      if (attempt >= 4) throw error;
    }
  }
}

if (missing.length > 0) {
  console.log(`Issued ${missing.length} new link(s).\n`);
}

// Only people who actually play this sport. Football's roster is twelve, not
// seventeen — the five who never played were removed rather than left rated,
// and sending them a football link would ask them to judge a game they have
// not seen.
const roster = await db
  .select({ name: players.name, token: players.raterToken })
  .from(profiles)
  .innerJoin(players, eq(players.id, profiles.playerId))
  .where(eq(profiles.sport, sport))
  .orderBy(asc(players.name));

const width = Math.max(...roster.map((r) => r.name.length));

console.log(
  `${SPORTS[sport].label} — ${roster.length} links. Send one each.\n`,
);
console.log(
  `  ${SESSION_TARGET} questions, in ${round.length} part(s), on one link:`,
);
for (const [i, a] of round.entries()) {
  console.log(`    ${i + 1}. ${a.label.padEnd(12)} "${a.question}"`);
}
console.log();
for (const person of roster) {
  if (!person.token) continue; // Unreachable: every row was just backfilled.
  console.log(
    `  ${person.name.padEnd(width)}  ${base}${raterPath(sport, person.token, axisKey)}`,
  );
}
console.log();
