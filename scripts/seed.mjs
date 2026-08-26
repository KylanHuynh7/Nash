/**
 * Seeds a demo basketball roster for local verification.
 *   npx dotenv -e .env.local -- node scripts/seed.mjs
 *   npx dotenv -e .env.local -- node scripts/seed.mjs --clear
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

if (process.argv.includes("--clear")) {
  await sql`delete from runs`;
  await sql`delete from profiles`;
  await sql`delete from players`;
  console.log("cleared roster");
  process.exit(0);
}

// name, position, [shooting, finishing, playmaking, defense, rebounding, athleticism]
const DEMO = [
  ["Kylan", "guard", [90, 82, 88, 80, 62, 84]],
  ["Marcus", "wing", [92, 78, 74, 70, 68, 80]],
  ["Dre", "big", [58, 90, 62, 88, 92, 82]],
  ["Tyler", "guard", [80, 76, 86, 78, 60, 78]],
  ["Jalen", "wing", [74, 82, 72, 80, 74, 88]],
  ["Chris", "big", [62, 84, 60, 82, 88, 72]],
  ["Andre", "guard", [76, 68, 80, 72, 58, 74]],
  ["Mike", "wing", [70, 72, 68, 74, 70, 76]],
  ["Sam", "big", [55, 74, 58, 76, 82, 66]],
  ["Nate", "guard", [72, 62, 70, 64, 55, 68]],
  ["Josh", "wing", [64, 66, 62, 68, 64, 70]],
];

const KEYS = ["shooting", "finishing", "playmaking", "defense", "rebounding", "athleticism"];
const WEIGHTS = [1.15, 1.1, 1.05, 1.1, 0.85, 0.95];

for (const [name, position, values] of DEMO) {
  const ratings = Object.fromEntries(KEYS.map((k, i) => [k, values[i]]));
  const weighted = values.reduce((s, v, i) => s + v * WEIGHTS[i], 0);
  const overall = Math.round(weighted / WEIGHTS.reduce((s, w) => s + w, 0));

  const [player] = await sql`
    insert into players (name) values (${name}) returning id
  `;
  await sql`
    insert into profiles (player_id, sport, position, ratings, overall)
    values (${player.id}, 'basketball', ${position}, ${JSON.stringify(ratings)}, ${overall})
  `;
  console.log(`  ${name.padEnd(8)} ${position.padEnd(6)} ${overall}`);
}
console.log(`seeded ${DEMO.length} players`);
