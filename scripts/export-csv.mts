/**
 * Exports a sport's roster as CSV for collecting second opinions.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/export-csv.mts basketball > ratings.csv
 *
 * Columns follow the sport's attribute order from lib/sports.ts. Trailing blank
 * columns are there for a reviewer to fill in. The output is also a valid input
 * for `rate.ts --file`, so a marked-up sheet can be applied straight back.
 */
import { neon } from "@neondatabase/serverless";
import { RATING_MAX, RATING_MIN, SPORTS, formatHeight, isSportId } from "../lib/sports";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Prefix with: npx dotenv -e .env.local --");
  process.exit(1);
}
const sql = neon(url);

const sportArg = process.argv[2];
if (!sportArg || !isSportId(sportArg)) {
  console.error(`usage: export-csv.mts <${Object.keys(SPORTS).join("|")}>`);
  process.exit(1);
}
const config = SPORTS[sportArg];

const rows = await sql`
  select p.name, p.height_inches, pr.position, pr.ratings, pr.overall
    from profiles pr
    join players p on p.id = pr.player_id
   where pr.sport = ${config.id}
   order by pr.overall desc, p.name
`;

/** Quote a field only when it needs it, so the file stays readable. */
const cell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Lowercase attribute headers so `rate.ts --file` can read this back directly.
const header = [
  "rank",
  "name",
  "position",
  "height",
  ...config.attributes.map((a) => a.key),
  "overall",
  "your overall",
  "too high / too low / right",
  "notes",
];

const lines = [header.map(cell).join(",")];

rows.forEach((r, i) => {
  lines.push(
    [
      i + 1,
      r.name,
      r.position,
      formatHeight(r.height_inches) ?? "",
      ...config.attributes.map((a) => r.ratings[a.key] ?? ""),
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
const weights = [...config.attributes]
  .sort((a, b) => b.weight - a.weight)
  .map((a) => `${a.label} ${a.weight.toFixed(2)}`)
  .join(", ");

lines.push("");
lines.push(cell(`Scale: ${RATING_MIN} = lowest in this group, ${RATING_MAX} = highest. Relative to these ${rows.length} only.`));
lines.push(cell(`Weights: ${weights}`));

console.log(lines.join("\n"));
