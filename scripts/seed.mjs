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

// name, position, flat starting rating (tuned per player in the app)
const DEMO = [
  ["Victor", "wing", 70],
  ["Jason", "wing", 70],
  ["Kylan", "guard", 70],
  ["Danny", "wing", 70],
  ["Joe", "wing", 70],
  ["Justin", "wing", 70],
  ["Taha", "wing", 70],
  ["Bang", "wing", 70],
  ["David", "wing", 70],
  ["Brendan", "wing", 70],
  ["Sean", "wing", 70],
  ["Eric", "wing", 70],
  ["Orion", "wing", 70],
  ["Rayan", "wing", 70],
];

const KEYS = ["shooting", "finishing", "playmaking", "defense", "rebounding", "athleticism"];

for (const [name, position, base] of DEMO) {
  const ratings = Object.fromEntries(KEYS.map((k) => [k, base]));
  const overall = base;

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
