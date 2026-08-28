/**
 * Fits a Bradley-Terry model to the pairwise comparisons and proposes overalls.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/fit-bt.mts basketball
 *
 * Flags:
 *   --lambda N   shrinkage toward the existing ratings (default 1.0)
 *   --axis KEY   which question to fit (default "overall")
 *
 * It writes nothing. The fit proposes, a person applies - a model that edits
 * the roster on its own is a model nobody checks.
 *
 * The model
 * ---------
 * Every player gets a latent strength s. The probability that the group prefers
 * i to j is sigma(s_i - s_j). That is Bradley-Terry, the model Elo descends
 * from, and it is the right shape for this data: it needs no calibrated scale
 * from the raters, only which of two names they picked.
 *
 * Fitting is penalised maximum likelihood. The penalty pulls each strength
 * toward the existing single-rater rating, which does two useful things:
 *
 *  - A player nobody was asked about keeps his current number instead of
 *    drifting to the middle of the scale.
 *  - Shrinkage is automatically per-player. The likelihood's curvature grows
 *    with how many comparisons a player appeared in, so a single global lambda
 *    already moves well-covered players a lot and thinly-covered ones barely.
 *
 * That is deliberate: the existing ratings are biased, not worthless, and with
 * a few hundred comparisons the honest answer is a blend, not a replacement.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { comparisons, players, profiles } from "../db/schema";
import { RATING_MAX, RATING_MIN, isSportId } from "../lib/sports";

const argv = process.argv.slice(2);
const sport = argv.find((a) => !a.startsWith("--"));
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

if (!sport || !isSportId(sport)) {
  console.error("usage: fit-bt.mts <sport> [--lambda N] [--axis KEY]");
  process.exit(1);
}

const axis = flag("axis") ?? "overall";
const lambda = Number(flag("lambda") ?? 1);

/**
 * Rating points per unit of latent strength.
 *
 * Sets what the model's scale means in the app's 65-99 terms. At 5, a ten-point
 * gap in overall is two latent units, i.e. the model expects the better player
 * to be preferred about 88% of the time - which is roughly how a ten-point gap
 * on this ladder actually plays.
 */
const POINTS_PER_UNIT = 5;

const db = getDb();

const roster = await db
  .select({
    id: players.id,
    name: players.name,
    overall: profiles.overall,
  })
  .from(profiles)
  .innerJoin(players, eq(players.id, profiles.playerId))
  .where(eq(profiles.sport, sport));

const rows = await db
  .select({
    raterId: comparisons.raterId,
    leftId: comparisons.leftId,
    rightId: comparisons.rightId,
    winnerId: comparisons.winnerId,
  })
  .from(comparisons)
  .where(and(eq(comparisons.sport, sport), eq(comparisons.axis, axis)));

// "Too close to call" is kept in the table because it is evidence two players
// are near each other, but plain Bradley-Terry has no tie term. Modelling ties
// properly (Davidson) is worth doing once there are enough of them to estimate
// the extra parameter; until then, dropping is the honest move.
const ties = rows.filter((r) => r.winnerId === null).length;
const decided = rows.filter((r) => r.winnerId !== null);

// A rater judging themselves is refused at write time, but the fit re-checks:
// this is the one filter that must never silently lapse.
const clean = decided.filter(
  (r) => r.raterId !== r.leftId && r.raterId !== r.rightId,
);

if (clean.length === 0) {
  console.error(`No comparisons yet for ${sport} / ${axis}.`);
  process.exit(1);
}

const index = new Map(roster.map((p, i) => [p.id, i]));
const n = roster.length;
const meanOverall =
  roster.reduce((sum, p) => sum + p.overall, 0) / Math.max(1, n);
const prior = roster.map((p) => (p.overall - meanOverall) / POINTS_PER_UNIT);

type Obs = { win: number; lose: number };
const obs: Obs[] = [];
const appearances = new Array<number>(n).fill(0);
for (const row of clean) {
  const w = index.get(row.winnerId!);
  const l = index.get(row.winnerId === row.leftId ? row.rightId : row.leftId);
  if (w === undefined || l === undefined) continue;
  obs.push({ win: w, lose: l });
  appearances[w]++;
  appearances[l]++;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// Gradient ascent on the penalised log-likelihood. Seventeen parameters and a
// concave objective - there is nothing here worth a fancier optimiser.
const s = [...prior];
const STEP = 0.05;
for (let iter = 0; iter < 20000; iter++) {
  const grad = new Array<number>(n).fill(0);
  for (const { win, lose } of obs) {
    const p = sigmoid(s[win] - s[lose]);
    const g = 1 - p;
    grad[win] += g;
    grad[lose] -= g;
  }
  for (let i = 0; i < n; i++) grad[i] -= lambda * (s[i] - prior[i]);

  let moved = 0;
  for (let i = 0; i < n; i++) {
    const delta = STEP * grad[i];
    s[i] += delta;
    moved = Math.max(moved, Math.abs(delta));
  }
  // Only differences are identified, so the scale is pinned by centring.
  const mean = s.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) s[i] -= mean;
  if (moved < 1e-9) break;
}

const fitted = roster.map((p, i) => {
  const raw = meanOverall + s[i] * POINTS_PER_UNIT;
  return {
    ...p,
    appearances: appearances[i],
    proposed: Math.round(
      Math.min(RATING_MAX, Math.max(RATING_MIN, raw)),
    ),
    unclamped: raw,
  };
});

/* ------------------------------------------------------------------ *
 * Diagnostics
 *
 * The single most useful output here is not the new numbers - it is whether the
 * raters agree with each other more than they agree with the existing ratings.
 * If they do, the existing ratings are the outlier, and that is the finding.
 * ------------------------------------------------------------------ */

const byRater = new Map<string, typeof clean>();
for (const row of clean) {
  const list = byRater.get(row.raterId) ?? [];
  list.push(row);
  byRater.set(row.raterId, list);
}

const nameOf = new Map(roster.map((p) => [p.id, p.name]));
const overallOf = new Map(roster.map((p) => [p.id, p.overall]));

/** Share of comparisons where the higher current rating was the one picked. */
function agreementWithCurrent(list: typeof clean): number {
  let hits = 0;
  let total = 0;
  for (const row of list) {
    const a = overallOf.get(row.leftId);
    const b = overallOf.get(row.rightId);
    if (a === undefined || b === undefined || a === b) continue;
    const favourite = a > b ? row.leftId : row.rightId;
    total++;
    if (row.winnerId === favourite) hits++;
  }
  return total === 0 ? NaN : hits / total;
}

/** Share where the fitted consensus picked the same winner the rater did. */
function agreementWithConsensus(list: typeof clean): number {
  let hits = 0;
  let total = 0;
  for (const row of list) {
    const a = index.get(row.leftId);
    const b = index.get(row.rightId);
    if (a === undefined || b === undefined) continue;
    const favourite = s[a] > s[b] ? row.leftId : row.rightId;
    total++;
    if (row.winnerId === favourite) hits++;
  }
  return total === 0 ? NaN : hits / total;
}

const pct = (x: number) => (Number.isNaN(x) ? "  n/a" : `${(x * 100).toFixed(0)}%`);

console.log(`\n${sport} / ${axis}`);
console.log(
  `${clean.length} usable comparisons from ${byRater.size} rater(s)` +
    (ties > 0 ? `, ${ties} "too close to call" dropped` : "") +
    `, lambda ${lambda}\n`,
);

const covered = appearances.filter((a) => a > 0).length;
const thin = fitted.filter((f) => f.appearances < 8);
console.log(
  `Coverage: ${covered}/${n} players seen, median ${
    [...appearances].sort((a, b) => a - b)[Math.floor(n / 2)]
  } appearances each`,
);
if (thin.length > 0) {
  console.log(
    `  Thin (<8): ${thin.map((t) => `${t.name} ${t.appearances}`).join(", ")}`,
  );
}

console.log("\nRater agreement");
console.log("  rater            n   vs current   vs consensus");
for (const [raterId, list] of [...byRater].sort(
  (a, b) => b[1].length - a[1].length,
)) {
  const name = (nameOf.get(raterId) ?? raterId).padEnd(14);
  console.log(
    `  ${name} ${String(list.length).padStart(4)}      ${pct(
      agreementWithCurrent(list),
    )}         ${pct(agreementWithConsensus(list))}`,
  );
}
console.log(
  `  ${"ALL".padEnd(14)} ${String(clean.length).padStart(4)}      ${pct(
    agreementWithCurrent(clean),
  )}         ${pct(agreementWithConsensus(clean))}`,
);
console.log(
  "\n  'vs current' below 'vs consensus' means the group agrees with each other\n" +
    "  more than they agree with the existing ratings - the ratings are what moved.",
);

console.log("\nProposed overalls");
console.log("  player          n    now   fit   delta");
for (const f of [...fitted].sort((a, b) => b.proposed - a.proposed)) {
  const delta = f.proposed - f.overall;
  const mark = Math.abs(delta) >= 4 ? "  <-- moved" : "";
  console.log(
    `  ${f.name.padEnd(14)} ${String(f.appearances).padStart(3)}    ${String(
      f.overall,
    ).padStart(3)}   ${String(f.proposed).padStart(3)}   ${
      delta > 0 ? "+" : ""
    }${delta}${mark}`,
  );
}

const clamped = fitted.filter(
  (f) => f.unclamped < RATING_MIN - 0.5 || f.unclamped > RATING_MAX + 0.5,
);
if (clamped.length > 0) {
  console.log(
    `\n  Clamped to the ${RATING_MIN}-${RATING_MAX} scale: ${clamped
      .map((c) => c.name)
      .join(", ")}`,
  );
}

console.log("\nNothing was written. Apply changes in the editor.\n");
