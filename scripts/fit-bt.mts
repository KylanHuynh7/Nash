/**
 * Fits a Bradley-Terry model to the pairwise comparisons and proposes overalls.
 *
 *   npx dotenv -e .env.local -- npx tsx scripts/fit-bt.mts basketball
 *
 * Flags:
 *   --lambda N   shrinkage toward the existing ratings (default 1.0)
 *   --axis KEY   which question to fit (default "overall"). An axis that names
 *                an attribute fits that attribute: prior, proposal and scale
 *                are all the attribute's, not the overall's.
 *   --exclude NAME[,NAME]  drop these raters' rows from the fit
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
import {
  RATING_DEFAULT,
  RATING_MAX,
  RATING_MIN,
  SPORTS,
  isSportId,
} from "../lib/sports";
import {
  agreementWithConsensus,
  agreementWithCurrent,
  dropSelfComparisons,
  dropTies,
  excludeRaters,
  fitBradleyTerry,
} from "../lib/bt";

const argv = process.argv.slice(2);
const sport = argv.find((a) => !a.startsWith("--"));
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

if (!sport || !isSportId(sport)) {
  console.error(
    "usage: fit-bt.mts <sport> [--lambda N] [--axis KEY] [--exclude NAME,...]",
  );
  process.exit(1);
}

const axis = flag("axis") ?? "overall";
/*
 * What a fit on this axis is actually estimating.
 *
 * "overall" proposes `profiles.overall` — the weighted mean of the attributes.
 * Any other axis names an attribute, and then the attribute's own rating is
 * both the shrinkage prior and the thing a proposal applies to. Fitting a
 * throwing pass against the overall as prior would shrink arm strength toward
 * general football ability, which is precisely the thing it is not.
 */
const axisConfig = SPORTS[sport].axes.find((a) => a.key === axis);
if (!axisConfig) {
  console.error(
    `Unknown axis "${axis}" for ${sport}. Configured: ${SPORTS[sport].axes
      .map((a) => a.key)
      .join(", ")}`,
  );
  process.exit(1);
}
const attribute = axisConfig.attribute;
const lambda = Number(flag("lambda") ?? 1);
/*
 * Raters to leave out of the fit.
 *
 * The case this exists for: whoever set the stored ratings is already in the
 * model as the shrinkage prior, so their pairwise answers count them twice -
 * once as the prior every strength is pulled toward, once as a voter. Excluding
 * them at fit time is reversible and leaves the rows in the table, which
 * matters because those rows are the only test-retest reading available: how
 * often one person's four-second gut disagrees with their own stored ratings.
 * Deleting them to solve the double-count would destroy that reading for good.
 */
const excluded = (flag("exclude") ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);


const db = getDb();

const rosterRows = await db
  .select({
    id: players.id,
    name: players.name,
    overall: profiles.overall,
    ratings: profiles.ratings,
  })
  .from(profiles)
  .innerJoin(players, eq(players.id, profiles.playerId))
  .where(eq(profiles.sport, sport));

const roster = rosterRows.map((p) => ({
  id: p.id,
  name: p.name,
  current: attribute ? (p.ratings[attribute] ?? RATING_DEFAULT) : p.overall,
}));

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
const ties = rows.length - dropTies(rows).length;
const decided = dropTies(rows);

// A rater judging themselves is refused at write time, but the fit re-checks:
// this is the one filter that must never silently lapse.
const selfFree = dropSelfComparisons(decided);

const excludedIds = new Set(
  roster.filter((p) => excluded.includes(p.name.toLowerCase())).map((p) => p.id),
);
for (const name of excluded) {
  if (!roster.some((p) => p.name.toLowerCase() === name)) {
    console.error(`warning: --exclude "${name}" matched nobody on the roster`);
  }
}
const clean = excludeRaters(selfFree, excludedIds);
const droppedByExclude = selfFree.length - clean.length;

if (clean.length === 0) {
  console.error(`No comparisons yet for ${sport} / ${axis}.`);
  process.exit(1);
}

const fit = fitBradleyTerry(roster, clean, { lambda });
const { appearances, strengths: s } = fit;
const n = roster.length;

const fitted = roster.map((p, i) => ({
  ...p,
  appearances: appearances[i],
  proposed: fit.proposed[i],
  unclamped: fit.unclamped[i],
}));

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
const currentOf = new Map(roster.map((p) => [p.id, p.current]));
const strengthOf = new Map(roster.map((p, i) => [p.id, s[i]]));

const pct = (x: number) => (Number.isNaN(x) ? "  n/a" : `${(x * 100).toFixed(0)}%`);

console.log(`\n${sport} / ${axis}`);
console.log(
  `${clean.length} usable comparisons from ${byRater.size} rater(s)` +
    (droppedByExclude > 0
      ? `, ${droppedByExclude} excluded (${excluded.join(", ")})`
      : "") +
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
      agreementWithCurrent(list, currentOf),
    )}         ${pct(agreementWithConsensus(list, strengthOf))}`,
  );
}
console.log(
  `  ${"ALL".padEnd(14)} ${String(clean.length).padStart(4)}      ${pct(
    agreementWithCurrent(clean, currentOf),
  )}         ${pct(agreementWithConsensus(clean, strengthOf))}`,
);
console.log(
  "\n  'vs current' below 'vs consensus' means the group agrees with each other\n" +
    "  more than they agree with the existing ratings - the ratings are what moved.",
);

console.log(
  `\nProposed ${attribute ? `${attribute} ratings` : "overalls"}`,
);
console.log("  player          n    now   fit   delta");
for (const f of [...fitted].sort((a, b) => b.proposed - a.proposed)) {
  const delta = f.proposed - f.current;
  const mark = Math.abs(delta) >= 4 ? "  <-- moved" : "";
  console.log(
    `  ${f.name.padEnd(14)} ${String(f.appearances).padStart(3)}    ${String(
      f.current,
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
