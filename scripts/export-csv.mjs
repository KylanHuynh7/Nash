/**
 * Exports the basketball roster as CSV for collecting second opinions.
 *
 *   npx dotenv -e .env.local -- node scripts/export-csv.mjs > ratings.csv
 *
 * Trailing blank columns are there for a reviewer to fill in.
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const KEYS = ["shooting", "finishing", "playmaking", "defense", "rebounding", "athleticism"];

const rows = await sql`
  select p.name, p.height_inches, pr.position, pr.ratings, pr.overall
    from profiles pr
    join players p on p.id = pr.player_id
   where pr.sport = 'basketball'
   order by pr.overall desc, p.name
`;

/** Quote a field only when it needs it, so the file stays readable. */
const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const header = [
  "Rank",
  "Name",
  "Position",
  "Height",
  "Shooting",
  "Finishing",
  "Playmaking",
  "Defense",
  "Rebounding",
  "Athleticism",
  "Overall",
  "Your Overall",
  "Too High / Too Low / Right",
  "Notes",
];

const lines = [header.map(cell).join(",")];

rows.forEach((r, i) => {
  const height = r.height_inches
    ? `${Math.floor(r.height_inches / 12)}'${r.height_inches % 12}"`
    : "";
  lines.push(
    [
      i + 1,
      r.name,
      r.position.toUpperCase(),
      height,
      ...KEYS.map((k) => r.ratings[k] ?? ""),
      r.overall,
      "",
      "",
      "",
    ]
      .map(cell)
      .join(","),
  );
});

// A short legend keeps the scale from being read as an absolute grade.
lines.push("");
lines.push(cell("Scale: 65 = lowest in this group, 99 = highest. Relative to these 15 only."));
lines.push(cell("Weights (full court to 11): Athleticism 1.25, Finishing 1.15, Rebounding 1.15, Defense 1.10, Shooting 1.05, Playmaking 1.00"));

console.log(lines.join("\n"));
