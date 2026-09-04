/**
 * Audit a sport's rating sheet for the defects you cannot see by reading it.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/audit.mts football
 *
 * Read-only. It never writes a rating, and it makes no judgement about what
 * should change - it reports the five things that have historically been wrong
 * with a hand-rated sheet here and leaves the calls to a person:
 *
 *   1. Ties        a value shared by 3+ players (the ladder-fill signature)
 *   2. Duplicates  two attributes that rank everyone the same way
 *   3. Amplifiers  attributes that track the overall AND carry a heavy weight
 *   4. Dimensions  how many things the sheet is actually measuring
 *   5. Resolution  where the ladder is real and where it is a coin flip
 *
 * Run it at the end of a rating session, alongside the whole-roster diff
 * context.md 6y asks for. The diff finds who was never reviewed; this finds
 * which columns were never really rated.
 *
 * The maths lives in lib/audit.ts and is tested against synthetic data whose
 * answers are known. This file only fetches, arranges and prints.
 */
import { neon } from "@neondatabase/serverless";
import {
  buildMatrix,
  column,
  componentsToReach,
  correlationPairs,
  correlationWith,
  principalComponents,
  residuals,
  sharedValues,
  weightSensitivity,
} from "../lib/audit";
import { SPORTS, computeOverall, isSportId } from "../lib/sports";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Prefix with: npx dotenv -e .env.local --");
  process.exit(1);
}
const sql = neon(url);

const sportArg = process.argv[2];
if (!sportArg || !isSportId(sportArg)) {
  console.error(`usage: audit.mts <${Object.keys(SPORTS).join("|")}>`);
  process.exit(1);
}
const config = SPORTS[sportArg];

/** Deterministic, so two runs on an unchanged sheet print the same numbers. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows = (await sql`
  SELECT p.name, f.ratings
  FROM players p
  JOIN profiles f ON f.player_id = p.id AND f.sport = ${config.id}
  ORDER BY f.overall DESC, p.name
`) as { name: string; ratings: Record<string, number> }[];

if (rows.length < 4) {
  console.error(`Only ${rows.length} rated players. Nothing here is meaningful below four.`);
  process.exit(1);
}

const all = config.attributes.map((a) => a.key);
const scored = config.attributes.filter((a) => a.inOverall !== false);
const weights = Object.fromEntries(scored.map((a) => [a.key, a.weight]));
const label = new Map(config.attributes.map((a) => [a.key, a.label]));

const full = buildMatrix(all, rows);
const inOverall = buildMatrix(scored.map((a) => a.key), rows);
const overall = rows.map((r) => computeOverall(config, r.ratings));

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const sign = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}`;
const pad = Math.max(...all.map((k) => (label.get(k) ?? k).length));
const name = (k: string) => (label.get(k) ?? k).padEnd(pad);

console.log(`\n${config.label} — rating sheet audit`);
console.log(`${rows.length} players, ${all.length} attributes (${scored.length} in the overall)\n`);

// 1. Ties -----------------------------------------------------------------
console.log("1. SHARED VALUES — a value held by 3+ players");
const ties = sharedValues(full, 3);
if (ties.length === 0) {
  console.log("   none.\n");
} else {
  for (const t of ties) {
    console.log(`   ${name(t.key)}  ${String(t.value).padStart(3)}  x${t.names.length}: ${t.names.join(", ")}`);
  }
  console.log(
    "   A tie is only a fill when the tied players have nothing in common;\n" +
      "   a floor shared by everyone who cannot do the thing is honest.\n",
  );
}

// 2. Duplicated columns ---------------------------------------------------
console.log("2. ATTRIBUTE PAIRS — most correlated first");
const pairs = correlationPairs(full);
for (const p of pairs.slice(0, 6)) {
  const flag = Math.abs(p.r) >= 0.95 ? "  <-- one column, charged twice" : "";
  console.log(`   ${sign(p.r)}  ${label.get(p.a) ?? p.a} ~ ${label.get(p.b) ?? p.b}${flag}`);
}
const worst = pairs[0];
if (worst && Math.abs(worst.r) >= 0.9) {
  const res = residuals(column(full, worst.a), column(full, worst.b));
  console.log(
    `   residual spread of ${label.get(worst.a) ?? worst.a} after removing ` +
      `${label.get(worst.b) ?? worst.b}: ${res.spread.toFixed(1)} points`,
  );
  console.log("   Judge a redundant column by that spread, not by the correlation.");
}
console.log();

// 3. Amplifiers -----------------------------------------------------------
console.log("3. AGAINST THE OVERALL — an attribute that tracks it and weighs heavily");
console.log("   amplifies the existing order instead of contributing to it.");
const vsOverall = correlationWith(inOverall, overall)
  .filter((o) => o.r !== null)
  .sort((a, b) => a.r! - b.r!);
for (const o of vsOverall) {
  const w = weights[o.key] ?? 0;
  const flag = o.r! >= 0.93 && w >= 1.1 ? "  <-- heavy and redundant" : "";
  console.log(`   ${name(o.key)}  r=${sign(o.r!)}   weight ${w.toFixed(2)}${flag}`);
}
console.log();

// 4. Dimensions -----------------------------------------------------------
console.log("4. DIMENSIONS — how many things the sheet actually measures");
const { variance, loadings } = principalComponents(inOverall);
let cumulative = 0;
for (let i = 0; i < Math.min(5, variance.length); i++) {
  cumulative += variance[i];
  const top = loadings[i]
    .map((v, j) => ({ key: inOverall.keys[j], v }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 4)
    .map((t) => `${label.get(t.key) ?? t.key} ${sign(t.v)}`)
    .join(", ");
  console.log(`   PC${i + 1}  ${pct(variance[i]).padStart(6)}  (cum ${pct(cumulative).padStart(6)})  ${top}`);
}
console.log(`   ${componentsToReach(variance, 0.9)} components reach 90% of the variance.`);
console.log(`   Weight spent inside one component is spent on the same signal twice.\n`);

// 5. Resolution -----------------------------------------------------------
console.log("5. RESOLUTION — is the weight table doing anything, and where is");
console.log("   the ladder real?");
const sens = weightSensitivity(inOverall, weights, { rng: rng(11), trials: 4000 });
// Four decimals on purpose: the finding is *how close to 1* this sits, and
// two decimals round it to exactly the number that hides it.
console.log(`   weighted vs flat unweighted mean:  r = ${(sens.flatCorrelation ?? 0).toFixed(4)}`);
console.log(`   largest difference the weights make: ${sens.flatMaxDelta.toFixed(2)} points`);
console.log(`   weighting changes the order at all:  ${sens.flatOrderIdentical ? "NO" : "yes"}`);
console.log("\n   adjacent pairs under a +/-0.35 weight jitter:");
for (const p of sens.pairs) {
  const flag = p.reversed > 0.15 ? "  <-- unresolved" : "";
  console.log(
    `   ${p.a.padEnd(9)} vs ${p.b.padEnd(9)}  gap ${p.gap.toFixed(2).padStart(5)}   ` +
      `reversed ${pct(p.reversed).padStart(6)}${flag}`,
  );
}
console.log("\n   A pair that reverses under a jitter smaller than two honest raters");
console.log("   disagree by is not a ranking. Print it as a tie or separate them.\n");
