/**
 * What has been recorded, and what it says about the ratings. Reads, never
 * writes.
 *
 * Descriptive on purpose. Turning team outcomes into individual ratings is a
 * real model and a data-hungry one — each game is a single observation about a
 * ten-player split — so this reports what happened and says how far off having
 * enough it is. A per-player number off six games would be the "one person's
 * click rendered as the group" failure again.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/game-log.mts basketball
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { games } from "../db/schema";
import { SPORTS, isSportId } from "../lib/sports";
import { calibration, favourite, gamesNeeded, margin } from "../lib/games";

const sport = process.argv[2];
if (!sport || !isSportId(sport)) {
  console.error(`usage: game-log.mts <${Object.keys(SPORTS).join("|")}>`);
  process.exit(1);
}

const rows = await getDb()
  .select()
  .from(games)
  .where(eq(games.sport, sport))
  .orderBy(asc(games.playedAt));

if (rows.length === 0) {
  console.log(`\nNo ${sport} games recorded yet.\n`);
  console.log("  Record one from the run tab: play it, then put the final");
  console.log('  score in under "Record the result". The winner-stays-on');
  console.log("  buttons do not record anything.\n");
  process.exit(0);
}

console.log(`\n${SPORTS[sport].label} — ${rows.length} recorded game(s)\n`);

for (const row of rows) {
  const input = { teams: row.teams, winner: row.winner };
  const fav = favourite(input);
  const [a, b] = row.teams;
  const called =
    fav === null ? "level" : fav === row.winner ? "as rated" : "UPSET";
  console.log(
    `  ${String(row.playedAt).slice(4, 10)}  ` +
      `${a.score}-${b.score}  ` +
      `avg ${a.average.toFixed(1)} v ${b.average.toFixed(1)}  ` +
      `by ${margin(input)}  ${called}`,
  );
  console.log(
    `      ${row.teams
      .map((t) => t.players.map((p) => p.name).join(" "))
      .join("  |  ")}`,
  );
}

const c = calibration(rows.map((r) => ({ teams: r.teams, winner: r.winner })));
console.log(`\n  Games with a favourite to test: ${c.tested}`);
if (c.level) console.log(`  Level matchups (nothing predicted): ${c.level}`);

if (c.tested > 0) {
  const rate = c.favouriteWon / c.tested;
  console.log(
    `  Higher-rated side won: ${c.favouriteWon}/${c.tested} (${(rate * 100).toFixed(0)}%)`,
  );
  if (c.marginWhenFavouriteWon !== null) {
    console.log(`  Mean margin when it did:   ${c.marginWhenFavouriteWon.toFixed(1)}`);
  }
  if (c.marginWhenUnderdogWon !== null) {
    console.log(`  Mean margin when it didn't: ${c.marginWhenUnderdogWon.toFixed(1)}`);
  }

  /*
   * The bar, stated at a FIXED effect size rather than at the observed one.
   *
   * Sizing it to whatever deviation happens to be showing inverts the logic:
   * one recorded upset is a 50-point deviation, which asks for four games and
   * so declares itself nearly proven. The question worth powering for is
   * whether the ratings are off by something that would matter, and 10 points
   * off a coin flip is that. It wants 100 games.
   */
  const WORTH_DETECTING = 0.1;
  const need = gamesNeeded(WORTH_DETECTING);
  console.log(
    `\n  Teams are balanced to ~0.1, so a coin flip is the prediction and` +
      `\n  only a sustained deviation is evidence. Detecting a ${(WORTH_DETECTING * 100).toFixed(0)}-point` +
      `\n  deviation takes ~${need} games; there ${c.tested === 1 ? "is" : "are"} ${c.tested}.`,
  );
  if (c.tested < need) {
    console.log(`  Not a finding yet, whatever the rate above says. Keep recording.\n`);
  } else {
    console.log();
  }
}
