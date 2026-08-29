/**
 * What the badge catalogue does to the roster. Reads, never writes.
 *
 * The check 6b asked for and could not run: thresholds were chosen against a
 * stated intuition, and this is what tests them against it. Re-run after any
 * fitted rating is applied — the catalogue is fixed, the distribution is not.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/badge-report.mts basketball
 */
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { players, profiles } from "../db/schema";
import { SPORTS, isSportId, computeOverall } from "../lib/sports";
import { deriveBadges, residualStats, featured, tierLabel, TIERS } from "../lib/badges";

const sport = process.argv[2];
if (!sport || !isSportId(sport)) {
  console.error(`usage: badge-report.mts <${Object.keys(SPORTS).join("|")}>`);
  process.exit(1);
}
const config = SPORTS[sport];

const rows = await getDb()
  .select({ name: players.name, ratings: profiles.ratings })
  .from(profiles)
  .innerJoin(players, eq(players.id, profiles.playerId))
  .where(eq(profiles.sport, sport))
  .orderBy(asc(players.name));

const roster = rows.map((r) => ({ name: r.name, ratings: r.ratings }));
const stats = residualStats(config, roster);

const held = roster
  .map((p) => ({
    name: p.name,
    overall: computeOverall(config, p.ratings),
    badges: deriveBadges(config, p.ratings, roster, stats),
  }))
  .sort((a, b) => b.overall - a.overall);

const width = Math.max(...held.map((p) => p.name.length));

console.log(`\n${config.label} — badges over ${config.attributes.length} attributes, ${roster.length} players\n`);
for (const p of held) {
  const counts = {
    attribute: p.badges.filter((b) => b.family === "attribute").length,
    signature: p.badges.filter((b) => b.family === "signature").length,
    combination: p.badges.filter((b) => b.family === "combination").length,
  };
  const top = featured(p.badges)
    .map((b) => (b.tier ? `${b.name} (${tierLabel(b.tier)})` : b.name))
    .join(", ");
  console.log(
    `  ${p.name.padEnd(width)} ${String(p.overall).padStart(3)}  ` +
      `${String(p.badges.length).padStart(2)} total ` +
      `(${counts.attribute}a ${counts.signature}s ${counts.combination}c)  ` +
      `${top || "— none —"}`,
  );
}

const total = held.reduce((s, p) => s + p.badges.length, 0);
const none = held.filter((p) => p.badges.length === 0);
console.log(`\n  ${total} badges held, ${(total / roster.length).toFixed(1)} per player`);
console.log(`  ${roster.length - none.length} of ${roster.length} hold at least one`);
if (none.length) console.log(`  none: ${none.map((p) => p.name).join(", ")}`);

for (const tier of TIERS) {
  const n = held.reduce(
    (s, p) => s + p.badges.filter((b) => b.tier === tier.key).length,
    0,
  );
  console.log(`  ${tier.label.padEnd(13)} ${n}`);
}

// Which badges nobody holds. A badge nobody can earn is a badge that is not
// doing anything, and a badge everybody holds is not an accomplishment.
const tally = new Map<string, number>();
for (const p of held) for (const b of p.badges) tally.set(b.name, (tally.get(b.name) ?? 0) + 1);
const all = [...tally.entries()].sort((a, b) => b[1] - a[1]);
console.log(`\n  held by everyone: ${all.filter(([, n]) => n === roster.length).map(([k]) => k).join(", ") || "none"}`);
console.log(`  held by nobody:   ${all.length} of the catalogue fired; see the list below\n`);
for (const [name, n] of all) console.log(`    ${String(n).padStart(2)}  ${name}`);
