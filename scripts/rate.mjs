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
const WEIGHTS = { shooting: 1.15, finishing: 1.1, playmaking: 1.05, defense: 1.1, rebounding: 0.85, athleticism: 0.95 };

const [name, position, ...values] = process.argv.slice(2);
if (!name || !position || values.length !== KEYS.length) {
  console.error(`usage: rate.mjs <name> <guard|wing|big> ${KEYS.map((k) => `<${k}>`).join(" ")}`);
  process.exit(1);
}

const ratings = Object.fromEntries(KEYS.map((k, i) => [k, Number(values[i])]));
const weightSum = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
const overall = Math.round(
  KEYS.reduce((s, k) => s + ratings[k] * WEIGHTS[k], 0) / weightSum,
);

const [player] = await sql`select id from players where name = ${name} limit 1`;
if (!player) {
  console.error(`no player named "${name}"`);
  process.exit(1);
}

await sql`
  update profiles
     set position = ${position},
         ratings = ${JSON.stringify(ratings)},
         overall = ${overall},
         updated_at = now()
   where player_id = ${player.id} and sport = 'basketball'
`;

console.log(`${name} → ${position}, overall ${overall}`);
console.log("  " + KEYS.map((k) => `${k} ${ratings[k]}`).join("  "));
