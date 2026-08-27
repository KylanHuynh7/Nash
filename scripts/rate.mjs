/**
 * Applies a rated profile to one basketball player.
 *
 *   npx dotenv -e .env.local -- node scripts/rate.mjs \
 *     "Victor" wing <shooting> <finishing> <playmaking> <defense> <rebounding> <athleticism>
 *
 * Overall is the same weighted mean the app uses, so the value written here
 * matches what the editor would compute from these sliders.
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const KEYS = ["shooting", "finishing", "playmaking", "defense", "rebounding", "athleticism"];
const WEIGHTS = { shooting: 1.05, finishing: 1.15, playmaking: 1.0, defense: 1.1, rebounding: 1.15, athleticism: 1.25 };

const [name, position, ...rest] = process.argv.slice(2);
// Optional trailing height as 5'11" or 71.
let height = null;
if (rest.length > KEYS.length) {
  const raw = rest.pop();
  const feetInches = /^(\d)'(\d{1,2})"?$/.exec(raw);
  height = feetInches
    ? Number(feetInches[1]) * 12 + Number(feetInches[2])
    : Number(raw);
}
const values = rest;
if (!name || !position || values.length !== KEYS.length) {
  console.error(`usage: rate.mjs <name> <pg|sg|sf|pf|c> ${KEYS.map((k) => `<${k}>`).join(" ")} [height]`);
  process.exit(1);
}

const ratings = Object.fromEntries(KEYS.map((k, i) => [k, Number(values[i])]));
const weightSum = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
const overall = Math.round(
  KEYS.reduce((s, k) => s + ratings[k] * WEIGHTS[k], 0) / weightSum,
);

let [player] = await sql`select id from players where name = ${name} limit 1`;
let created = false;
if (!player) {
  [player] = await sql`insert into players (name) values (${name}) returning id`;
  created = true;
}

await sql`
  insert into profiles (player_id, sport, position, ratings, overall)
  values (${player.id}, 'basketball', ${position}, ${JSON.stringify(ratings)}, ${overall})
  on conflict (player_id, sport) do update
     set position = excluded.position,
         ratings = excluded.ratings,
         overall = excluded.overall,
         updated_at = now()
`;

if (height !== null && Number.isFinite(height)) {
  await sql`update players set height_inches = ${height} where id = ${player.id}`;
}

const shown = height ? ` ${Math.floor(height / 12)}'${height % 12}"` : "";
console.log(`${name}${created ? " (new)" : ""} → ${position}${shown}, overall ${overall}`);
console.log("  " + KEYS.map((k) => `${k} ${ratings[k]}`).join("  "));
