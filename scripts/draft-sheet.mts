/**
 * A blank draft board for collecting a second opinion.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/draft-sheet.mts basketball > draft-sheet.csv
 *
 * Deliberately carries no ratings and no rank order — seeing either one
 * anchors the answer, which is the whole thing this is trying to avoid.
 * Names are shuffled per run so even the row order gives nothing away.
 */
import { neon } from "@neondatabase/serverless";
import { SPORTS, formatHeight, isSportId } from "../lib/sports";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Prefix with: npx dotenv -e .env.local --");
  process.exit(1);
}
const sql = neon(url);

const sportArg = process.argv[2];
if (!sportArg || !isSportId(sportArg)) {
  console.error(`usage: draft-sheet.mts <${Object.keys(SPORTS).join("|")}>`);
  process.exit(1);
}
const config = SPORTS[sportArg];

const rows = await sql`
  select p.name, p.height_inches
    from profiles pr
    join players p on p.id = pr.player_id
   where pr.sport = ${config.id}
`;

// Fisher-Yates, so no residue of the rating order survives.
for (let i = rows.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [rows[i], rows[j]] = [rows[j], rows[i]];
}

console.log("Your pick order (1 = first player you'd take), Player, Height, Why");
for (const r of rows) {
  console.log(`,${r.name},"${formatHeight(r.height_inches) ?? ""}",`);
}
console.log("");
console.log(
  `"Rank all ${rows.length} from 1 to ${rows.length} for ${config.sideSize}v${config.sideSize} ${config.label.toLowerCase()}. No ties. Go with your gut — you're picking a team, not grading anyone."`,
);
