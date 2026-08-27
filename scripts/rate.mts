/**
 * Applies rated profiles for any sport. Attributes, weights, positions and the
 * rating scale all come from lib/sports.ts, so adding a sport there is enough.
 *
 * One player, named attributes in any order:
 *   npx dotenv -e .env.local -- npx tsx scripts/rate.mts basketball "Victor" pg \
 *     shooting=87 finishing=84 playmaking=88 defense=87 rebounding=79 athleticism=84 height=5'11"
 *
 * A whole roster from a CSV (name,position,height,<attribute columns by header>):
 *   npx dotenv -e .env.local -- npx tsx scripts/rate.mts football --file football-ratings.csv
 *
 * Attributes are named rather than positional because entering six numbers in
 * config order, seventeen times, is exactly where a silent transposition hides.
 * Overall is the same weighted mean the app computes, so a profile written here
 * matches what the editor would show.
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import {
  RATING_MAX,
  RATING_MIN,
  SPORTS,
  computeOverall,
  formatHeight,
  isSportId,
  type SportConfig,
} from "../lib/sports";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Prefix with: npx dotenv -e .env.local --");
  process.exit(1);
}
const sql = neon(url);

const [sportArg, ...rest] = process.argv.slice(2);

function usage(message: string): never {
  console.error(message);
  console.error(`\nusage: rate.mts <${Object.keys(SPORTS).join("|")}> <name> <position> key=value ...`);
  console.error(`       rate.mts <sport> --file <ratings.csv>`);
  for (const config of Object.values(SPORTS)) {
    console.error(
      `\n  ${config.id}: positions ${config.positions.map((p) => p.key).join("|")}` +
        `\n    attributes ${config.attributes.map((a) => a.key).join(", ")}`,
    );
  }
  process.exit(1);
}

if (!sportArg || !isSportId(sportArg)) usage(`Unknown sport: ${sportArg ?? "(none)"}`);
const config = SPORTS[sportArg];

/** 5'11" or 71 -> 71. Null when it isn't a height at all. */
function parseHeight(raw: string): number | null {
  const feetInches = /^(\d)'\s*(\d{1,2})"?$/.exec(raw.trim());
  const inches = feetInches
    ? Number(feetInches[1]) * 12 + Number(feetInches[2])
    : Number(raw);
  if (!Number.isFinite(inches)) return null;
  // Same 4'0"-7'6" guard the server action applies, so a typo can't land.
  return Math.min(90, Math.max(48, Math.round(inches)));
}

type Entry = {
  name: string;
  position: string;
  height: number | null;
  ratings: Record<string, number>;
};

/**
 * Ratings outside the scale are rejected rather than clamped: a 45 is a
 * mistake about the scale, and silently rewriting it to 65 hides that.
 */
function readRatings(source: Record<string, string>, where: string): Record<string, number> {
  const ratings: Record<string, number> = {};
  for (const attr of config.attributes) {
    const raw = source[attr.key];
    if (raw === undefined || raw === "") usage(`${where}: missing ${attr.key}`);
    const value = Number(raw);
    if (!Number.isInteger(value) || value < RATING_MIN || value > RATING_MAX) {
      usage(`${where}: ${attr.key}=${raw} is outside the ${RATING_MIN}-${RATING_MAX} scale`);
    }
    ratings[attr.key] = value;
  }
  return ratings;
}

function readPosition(raw: string, where: string): string {
  const key = raw.trim().toLowerCase();
  if (!config.positions.some((p) => p.key === key)) {
    usage(`${where}: unknown ${config.id} position "${raw}" — expected ${config.positions.map((p) => p.key).join("|")}`);
  }
  return key;
}

/** Minimal RFC-4180 row split: handles quoted fields and escaped quotes. */
function splitRow(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { out.push(field); field = ""; }
    else field += char;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

function fromFile(path: string): Entry[] {
  // Rows stop at the first blank line, which is where export-csv.mts starts
  // its legend — so an exported sheet can be marked up and fed straight back.
  const all = readFileSync(path, "utf8").split(/\r?\n/);
  const end = all.findIndex((line, i) => i > 0 && line.trim() === "");
  const lines = (end === -1 ? all : all.slice(0, end)).filter(
    (line) => line.trim() !== "" && !line.trimStart().startsWith("#"),
  );
  if (lines.length < 2) usage(`${path}: needs a header row and at least one player`);

  const header = splitRow(lines[0]).map((h) => h.toLowerCase());
  const required = ["name", "position", ...config.attributes.map((a) => a.key)];
  const missing = required.filter((key) => !header.includes(key));
  if (missing.length) usage(`${path}: header is missing ${missing.join(", ")}`);

  return lines.slice(1).map((line, i) => {
    const cells = splitRow(line);
    const row = Object.fromEntries(header.map((key, c) => [key, cells[c] ?? ""]));
    const where = `${path} line ${i + 2}`;
    if (!row.name) usage(`${where}: missing name`);
    return {
      name: row.name,
      position: readPosition(row.position, where),
      height: row.height ? parseHeight(row.height) : null,
      ratings: readRatings(row, where),
    };
  });
}

function fromArgs(args: string[]): Entry[] {
  const [name, position, ...pairs] = args;
  if (!name || !position) usage("Both a name and a position are required.");

  const fields: Record<string, string> = {};
  for (const pair of pairs) {
    const at = pair.indexOf("=");
    if (at < 1) usage(`Expected key=value, got "${pair}"`);
    fields[pair.slice(0, at).toLowerCase()] = pair.slice(at + 1);
  }

  const known = new Set([...config.attributes.map((a) => a.key), "height"]);
  const unknown = Object.keys(fields).filter((key) => !known.has(key));
  if (unknown.length) usage(`Not a ${config.id} attribute: ${unknown.join(", ")}`);

  return [{
    name,
    position: readPosition(position, name),
    height: fields.height ? parseHeight(fields.height) : null,
    ratings: readRatings(fields, name),
  }];
}

const entries =
  rest[0] === "--file"
    ? fromFile(rest[1] ?? usage("--file needs a path"))
    : fromArgs(rest);

async function apply(entry: Entry, config: SportConfig) {
  const overall = computeOverall(config, entry.ratings);

  let [player] = await sql`select id from players where name = ${entry.name} limit 1`;
  let created = false;
  if (!player) {
    [player] = await sql`insert into players (name) values (${entry.name}) returning id`;
    created = true;
  }

  await sql`
    insert into profiles (player_id, sport, position, ratings, overall)
    values (${player.id}, ${config.id}, ${entry.position}, ${JSON.stringify(entry.ratings)}, ${overall})
    on conflict (player_id, sport) do update
       set position = excluded.position,
           ratings = excluded.ratings,
           overall = excluded.overall,
           updated_at = now()
  `;

  // Height lives on the person, so only overwrite it when one was given —
  // a football entry must not blank out a height set from basketball.
  if (entry.height !== null) {
    await sql`update players set height_inches = ${entry.height} where id = ${player.id}`;
  }

  const shown = entry.height !== null ? ` ${formatHeight(entry.height)}` : "";
  console.log(
    `${entry.name}${created ? " (new)" : ""} → ${entry.position}${shown}, overall ${overall}`,
  );
  console.log(
    "  " + config.attributes.map((a) => `${a.key} ${entry.ratings[a.key]}`).join("  "),
  );
}

for (const entry of entries) await apply(entry, config);
console.log(`\n${entries.length} ${config.label.toLowerCase()} profile${entries.length === 1 ? "" : "s"} written.`);
