/**
 * Second split: basketball's nine attributes become fifteen, in place.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/split-attributes-2.mts --dry
 *   npx dotenv -e .env.local -- npx tsx scripts/split-attributes-2.mts --apply
 *
 *   finishing   -> driving_layup, post_control
 *   rebounding  -> def_reb, off_reb
 *   shooting    -> mid_range, three_point
 *   playmaking  -> pass_accuracy, ball_handle
 *   defense     -> + steal, block   (joining perimeter_d and interior_d)
 *
 * ## Why this one is ADDITIVE, and the first one was not
 *
 * `split-attributes.mts` built each profile's new ratings from scratch and
 * dropped the parents. That is what caused the outage recorded in context.md:
 * production was still running the six-key config, `athleticism` resolved to
 * `undefined`, and every card rendered `RATING_DEFAULT`. The lesson written
 * down then was "deploy the code first, then migrate".
 *
 * That lesson does not save this migration, because this one both ADDS ten
 * keys and ORPHANS four (`finishing`, `rebounding`, `shooting`, `playmaking`).
 * Migrate first and production — still on the nine-key config — loses those
 * four. Deploy first and the new config asks for ten keys the rows do not have
 * yet. **A destructive migration has no safe order.**
 *
 * So this one only ever adds. The four orphaned keys stay in the jsonb, unread
 * by the new config and still correct for the old one, which means BOTH deploy
 * states are valid and the ordering constraint disappears. They are deleted by
 * a separate cleanup pass once nothing reads them.
 *
 * The generalised rule, which is worth more than the original lesson:
 * **an additive migration is safe in any order; a destructive one is safe in
 * none.** Split every schema-shaped change into add-then-cleanup and the
 * deploy-ordering question stops existing.
 *
 * ## The guarantee
 *
 * No overall moves — verified twice, under BOTH configs:
 *
 *   1. under the new fifteen-attribute config, the shape being deployed to;
 *   2. under the frozen nine-attribute config, the shape production is still
 *      running right now.
 *
 * Either check failing refuses the write. Check 2 is the one that would have
 * caught the first outage.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { players, profiles } from "../db/schema";
import { SPORTS, computeOverall } from "../lib/sports";

const mode = process.argv.includes("--apply") ? "apply" : "dry";

/**
 * The nine-attribute config, frozen at the shape production is running.
 *
 * Copied rather than imported on purpose: `lib/sports.ts` is the fifteen now,
 * and a migration that checks the old state against a definition that moves
 * with the code is checking nothing.
 */
const OLD_ATTRS: { key: string; weight: number }[] = [
  { key: "speed", weight: 1.25 / 3 },
  { key: "strength", weight: 1.25 / 3 },
  { key: "stamina", weight: 1.25 / 3 },
  { key: "finishing", weight: 1.15 },
  { key: "rebounding", weight: 1.15 },
  { key: "perimeter_d", weight: 1.1 / 2 },
  { key: "interior_d", weight: 1.1 / 2 },
  { key: "shooting", weight: 1.05 },
  { key: "playmaking", weight: 1.0 },
];

function oldOverall(r: Record<string, number>): number {
  let total = 0;
  let weight = 0;
  for (const a of OLD_ATTRS) {
    if (typeof r[a.key] !== "number") return NaN;
    total += r[a.key] * a.weight;
    weight += a.weight;
  }
  return Math.round(Math.min(99, Math.max(65, total / weight)));
}

/**
 * Each new child, and the value it seeds from.
 *
 * `steal` and `block` are the interesting case. They join a Defense family
 * whose parent key no longer exists — the first split already replaced
 * `defense` with perimeter_d and interior_d. Seeding them at the MEAN of those
 * two is what keeps the family neutral: a four-child average
 * (p + i + m + m) / 4 with m = (p + i) / 2 is exactly (p + i) / 2, the
 * two-child average it replaces. Seeding them from either half alone would
 * quietly tilt every defensive rating toward that half.
 */
const SEED: Record<string, (r: Record<string, number>) => number> = {
  driving_layup: (r) => r.finishing,
  post_control: (r) => r.finishing,
  def_reb: (r) => r.rebounding,
  off_reb: (r) => r.rebounding,
  mid_range: (r) => r.shooting,
  three_point: (r) => r.shooting,
  pass_accuracy: (r) => r.playmaking,
  ball_handle: (r) => r.playmaking,
  steal: (r) => (r.perimeter_d + r.interior_d) / 2,
  block: (r) => (r.perimeter_d + r.interior_d) / 2,
};

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
type Planned = {
  id: string;
  name: string;
  next: Record<string, number>;
  was: number;
  now: number;
  oldNow: number;
};
const planned: Planned[] = [];

for (const row of rows) {
  const old = row.ratings;
  if (Object.keys(SEED).every((k) => typeof old[k] === "number")) {
    console.log(`  ${row.name}: already split, skipping`);
    continue;
  }
  // ADDITIVE: start from what is there and only ever add.
  const next: Record<string, number> = { ...old };
  for (const [key, seed] of Object.entries(SEED)) {
    if (typeof next[key] === "number") continue;
    const value = seed(old);
    if (typeof value !== "number" || !Number.isFinite(value)) {
      console.error(`  ${row.name}: cannot seed ${key}`);
      process.exit(1);
    }
    next[key] = value;
  }
  for (const attr of config.attributes) {
    if (typeof next[attr.key] !== "number") {
      console.error(`  ${row.name}: no value for ${attr.key}`);
      process.exit(1);
    }
  }
  planned.push({
    id: row.id,
    name: row.name,
    next,
    was: row.overall,
    now: computeOverall(config, next),
    oldNow: oldOverall(next),
  });
}

console.log("\n  player      stored  new-config  old-config");
let moved = 0;
for (const p of planned) {
  const bad = p.was !== p.now || p.was !== p.oldNow;
  if (bad) moved++;
  console.log(
    `  ${p.name.padEnd(10)} ${String(p.was).padStart(6)}  ${String(p.now).padStart(10)}  ${String(p.oldNow).padStart(10)}${bad ? "   <-- MOVED" : ""}`,
  );
}

if (moved > 0) {
  console.error(
    `\n  ${moved} overall(s) would change. The split is neutral on day one under BOTH configs or it does not ship — refusing to write.`,
  );
  process.exit(1);
}
console.log(
  `\n  ${planned.length} profiles. 0 overalls move under the new config, 0 under the old one.`,
);
console.log(
  "  Orphaned but retained: finishing, rebounding, shooting, playmaking.",
);

if (mode === "dry") {
  console.log("\n  Dry run. Re-run with --apply to write.\n");
  process.exit(0);
}

mkdirSync("backups", { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const file = `backups/basketball-profiles-pre-split-2-${stamp}.json`;
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
