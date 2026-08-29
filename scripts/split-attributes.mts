/**
 * Splits basketball's six attributes into nine, in place.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/split-attributes.mts --dry
 *   npx dotenv -e .env.local -- npx tsx scripts/split-attributes.mts --apply
 *
 * athleticism -> speed, strength, stamina
 * defense     -> perimeter_d, interior_d
 *
 * ## The guarantee
 *
 * **No overall moves.** Each child is seeded at its parent's exact value and
 * carries the parent's weight divided evenly, so a weighted mean over N copies
 * of V at weight w/N contributes precisely what one copy at weight w did. The
 * script recomputes every overall from the new ratings and **refuses to write
 * if a single one differs**. A migration that silently rewrites the roster is
 * the thing to be afraid of here.
 *
 * Day one only. Once collection lands real values for stamina, strength and
 * interior defense, overalls will move — that is the split working.
 *
 * ## Why a dump first
 *
 * Every environment shares one DATABASE_URL, so this is production. The
 * pre-split ratings cannot be reconstructed afterwards: three children seeded
 * from one parent are indistinguishable from three children that genuinely
 * agree. The dump goes in `backups/`, committed, for the same reason the
 * comparison dumps are.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { players, profiles } from "../db/schema";
import { SPORTS, computeOverall } from "../lib/sports";

const mode = process.argv.includes("--apply") ? "apply" : "dry";

/** child -> parent. The parent's value is copied into each child untouched. */
const SPLIT: Record<string, string> = {
  speed: "athleticism",
  strength: "athleticism",
  stamina: "athleticism",
  perimeter_d: "defense",
  interior_d: "defense",
};
const RETIRED = new Set(Object.values(SPLIT));

const db = getDb();
const rows = await db
  .select({
    id: profiles.id,
    name: players.name,
    ratings: profiles.ratings,
    overall: profiles.overall,
  })
  .from(profiles)
  .innerJoin(players, eq(players.id, profiles.playerId))
  .where(eq(profiles.sport, "basketball"));

if (rows.length === 0) {
  console.error("No basketball profiles found.");
  process.exit(1);
}

const config = SPORTS.basketball;
const planned: { id: string; name: string; next: Record<string, number>; was: number; now: number }[] = [];

for (const row of rows) {
  const old = row.ratings;
  // Already migrated? Then this is a re-run and there is nothing to do.
  if (!Object.keys(old).some((k) => RETIRED.has(k))) {
    console.log(`  ${row.name}: already split, skipping`);
    continue;
  }
  const next: Record<string, number> = {};
  for (const attr of config.attributes) {
    const parent = SPLIT[attr.key];
    const value = parent ? old[parent] : old[attr.key];
    if (typeof value !== "number") {
      console.error(`  ${row.name}: no value for ${attr.key} (parent ${parent ?? "-"})`);
      process.exit(1);
    }
    next[attr.key] = value;
  }
  planned.push({
    id: row.id,
    name: row.name,
    next,
    was: row.overall,
    now: computeOverall(config, next),
  });
}

console.log(`\n  player      was  now  ${config.attributes.map((a) => a.key.slice(0, 4).padStart(5)).join("")}`);
let moved = 0;
for (const p of planned) {
  const flag = p.was === p.now ? "" : "   <-- MOVED";
  if (p.was !== p.now) moved++;
  console.log(
    `  ${p.name.padEnd(10)} ${String(p.was).padStart(3)}  ${String(p.now).padStart(3)}  ` +
      config.attributes.map((a) => String(p.next[a.key]).padStart(5)).join("") +
      flag,
  );
}

if (moved > 0) {
  console.error(
    `\n  ${moved} overall(s) would change. The split is supposed to be neutral on day one — refusing to write.`,
  );
  process.exit(1);
}
console.log(`\n  ${planned.length} profiles, 0 overalls moved.`);

if (mode === "dry") {
  console.log("\n  Dry run. Re-run with --apply to write.\n");
  process.exit(0);
}

mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const file = `backups/basketball-profiles-pre-split-${stamp}.json`;
writeFileSync(
  file,
  JSON.stringify(
    rows.map((r) => ({ id: r.id, ratings: r.ratings, overall: r.overall })),
    null,
    2,
  ),
);
console.log(`  Wrote ${file} (ids only, no names).`);

for (const p of planned) {
  await db.update(profiles).set({ ratings: p.next }).where(eq(profiles.id, p.id));
}
console.log(`  Updated ${planned.length} profiles.\n`);
