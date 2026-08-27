/**
 * A blank draft board for collecting a second opinion.
 *
 *   npx dotenv -e .env.local -- node scripts/draft-sheet.mjs > draft-sheet.csv
 *
 * Deliberately carries no ratings and no rank order — seeing either one
 * anchors the answer, which is the whole thing this is trying to avoid.
 * Names are shuffled per run so even the row order gives nothing away.
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  select p.name, p.height_inches
    from profiles pr
    join players p on p.id = pr.player_id
   where pr.sport = 'basketball'
`;

// Fisher-Yates, so no residue of the rating order survives.
for (let i = rows.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [rows[i], rows[j]] = [rows[j], rows[i]];
}

console.log("Your pick order (1 = first player you'd take), Player, Height, Why");
for (const r of rows) {
  const height = r.height_inches
    ? `${Math.floor(r.height_inches / 12)}'${r.height_inches % 12}"`
    : "";
  console.log(`,${r.name},"${height}",`);
}
console.log("");
console.log(`"Rank all ${rows.length} from 1 to ${rows.length}. No ties. Go with your gut — you're picking a team, not grading anyone."`);
