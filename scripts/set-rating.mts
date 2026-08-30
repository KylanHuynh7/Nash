/**
 * Set ONE attribute for one or more players, and recompute their overalls.
 *
 * Built for recalibration, where the work is "move this attribute for these
 * five people" rather than "rewrite this player". `rate.mts` demands every
 * attribute on purpose — entering twelve numbers in config order, thirteen
 * times, is exactly where a silent transposition hides — but that safeguard
 * becomes the hazard when the edit is one column wide: re-typing eleven
 * untouched numbers to change the twelfth is eleven chances to fat-finger a
 * value nobody meant to touch.
 *
 * This is narrow instead of complete. It names one attribute, reads the rest
 * from the stored row, and can therefore never disturb them.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/set-rating.mts football \
 *     pass_rush Danny=97 Jason=88 Orion=76
 *
 * Prints what it will do and what each overall becomes. `--dry` stops there.
 */
import { neon } from "@neondatabase/serverless";
import {
  RATING_MAX,
  RATING_MIN,
  SPORTS,
  computeOverall,
  isSportId,
} from "../lib/sports";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Prefix with: npx dotenv -e .env.local --");
  process.exit(1);
}
const sql = neon(url);

const argv = process.argv.slice(2);
const dry = argv.includes("--dry");
const [sport, attribute, ...pairs] = argv.filter((a) => a !== "--dry");

function usage(message: string): never {
  console.error(message);
  console.error(
    `\nusage: set-rating.mts <${Object.keys(SPORTS).join("|")}> <attribute> Name=value ... [--dry]`,
  );
  process.exit(1);
}

if (!sport || !isSportId(sport)) usage(`Unknown sport: ${sport ?? "(none)"}`);
const config = SPORTS[sport];

if (!attribute || !config.attributes.some((a) => a.key === attribute)) {
  usage(
    `Not a ${config.id} attribute: ${attribute ?? "(none)"}\n` +
      `  known: ${config.attributes.map((a) => a.key).join(", ")}`,
  );
}
if (pairs.length === 0) usage("Name at least one player.");

const wanted = new Map<string, number>();
for (const pair of pairs) {
  const at = pair.lastIndexOf("=");
  if (at < 1) usage(`Expected Name=value, got "${pair}"`);
  const name = pair.slice(0, at);
  const value = Number(pair.slice(at + 1));
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    usage(`${name}: "${pair.slice(at + 1)}" is not a whole number`);
  }
  if (value < RATING_MIN || value > RATING_MAX) {
    usage(`${name}: ${value} is outside the ${RATING_MIN}-${RATING_MAX} scale`);
  }
  if (wanted.has(name)) usage(`${name} named twice`);
  wanted.set(name, value);
}

const rows = (await sql`
  SELECT p.id, p.name, f.ratings
  FROM players p
  JOIN profiles f ON f.player_id = p.id AND f.sport = ${sport}
`) as { id: string; name: string; ratings: Record<string, number> }[];

const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r]));
// Every name has to resolve BEFORE anything is written. A partial application
// is worse than a refusal: half a recalibration looks like a finished one.
const missing = [...wanted.keys()].filter((n) => !byName.has(n.toLowerCase()));
if (missing.length) {
  usage(
    `No ${config.id} profile for: ${missing.join(", ")}\n` +
      `  roster: ${rows.map((r) => r.name).join(", ")}`,
  );
}

const label = config.attributes.find((a) => a.key === attribute)!.label;
const width = Math.max(...[...wanted.keys()].map((n) => n.length));
const plan: { id: string; name: string; ratings: Record<string, number>; overall: number }[] = [];

console.log(`\n${config.label} — ${label}\n`);
for (const [name, value] of wanted) {
  const row = byName.get(name.toLowerCase())!;
  const was = row.ratings[attribute];
  const ratings = { ...row.ratings, [attribute]: value };
  const overall = computeOverall(config, ratings);
  const wasOverall = computeOverall(config, row.ratings);
  const move = value - was;
  console.log(
    `  ${row.name.padEnd(width)}  ${String(was).padStart(3)} -> ${String(value).padStart(3)}` +
      `  (${move > 0 ? "+" : ""}${move})   overall ${wasOverall} -> ${overall}`,
  );
  plan.push({ id: row.id, name: row.name, ratings, overall });
}

if (dry) {
  console.log(`\n  --dry: nothing written.\n`);
  process.exit(0);
}

for (const p of plan) {
  await sql`
    UPDATE profiles
    SET ratings = ${JSON.stringify(p.ratings)}::jsonb, overall = ${p.overall}
    WHERE player_id = ${p.id} AND sport = ${sport}
  `;
}
console.log(`\n  ${plan.length} updated.\n`);
