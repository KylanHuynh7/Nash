/**
 * The Bradley-Terry fit, extracted from `scripts/fit-bt.mts`.
 *
 * Pure and database-free on purpose. The script that used to hold this had a
 * live connection at module scope, so importing it to test the maths would
 * have opened a connection to the one database every environment shares - and
 * the fit is the piece most worth testing, because it is the only place an
 * opinion turns into a number.
 *
 * The model
 * ---------
 * Every player gets a latent strength s. The probability the group prefers i to
 * j is sigma(s_i - s_j). That is Bradley-Terry, the model Elo descends from,
 * and it is the right shape for this data: it asks nothing of the rater but
 * which of two names they picked.
 *
 * Fitting is penalised maximum likelihood. The penalty pulls each strength
 * toward that player's existing rating, which does two useful things:
 *
 *  - A player nobody was asked about keeps his current number instead of
 *    drifting to the middle of the scale.
 *  - Shrinkage is automatically per-player. The likelihood's curvature grows
 *    with how many comparisons a player appeared in, so one global lambda
 *    already moves well-covered players a lot and thinly-covered ones barely.
 */

/**
 * `current` is the existing single-rater rating on whatever axis is being fit:
 * the overall for the "overall" axis, that attribute's rating for any other.
 * It is the shrinkage prior, and the scale the fitted strengths are mapped back
 * onto. Not named `overall`, because a throwing fit shrinks toward throwing.
 */
export type BtPlayer = { id: string; name: string; current: number };

export type BtComparison = {
  raterId: string;
  leftId: string;
  rightId: string;
  /** Null means "too close to call". */
  winnerId: string | null;
};

/**
 * Rating points per unit of latent strength.
 *
 * Sets what the model's scale means in the app's 65-99 terms. At 5, a ten-point
 * gap in overall is two latent units - the model expects the better player to
 * be preferred about 88% of the time, which is roughly how a ten-point gap on
 * this ladder actually plays.
 */
export const POINTS_PER_UNIT = 5;

/**
 * Drops comparisons where the rater judged themselves.
 *
 * Refused at write time and again in the picker; this is the third guard, and
 * the one that runs over whatever is already in the table. Self-assessment in a
 * friend group is large and one-directional, so this filter must never lapse.
 */
export function dropSelfComparisons<T extends BtComparison>(rows: T[]): T[] {
  return rows.filter((r) => r.raterId !== r.leftId && r.raterId !== r.rightId);
}

/**
 * Drops "too close to call".
 *
 * They stay in the table because they are evidence two players are near each
 * other, but plain Bradley-Terry has no tie term. Modelling ties properly
 * (Davidson) is worth doing once there are enough to estimate the extra
 * parameter; until then, dropping is the honest move.
 */
export function dropTies<T extends BtComparison>(rows: T[]): T[] {
  return rows.filter((r) => r.winnerId !== null);
}

/** Drops every row from the named raters. */
export function excludeRaters<T extends BtComparison>(
  rows: T[],
  raterIds: Set<string>,
): T[] {
  return rows.filter((r) => !raterIds.has(r.raterId));
}

export type BtFit = {
  /** Latent strength per roster index, centred so the mean is zero. */
  strengths: number[];
  /** How many comparisons each player appeared in. */
  appearances: number[];
  /** The proposed rating on this axis, clamped to the scale and rounded. */
  proposed: number[];
  /** The same figure before clamping and rounding, for diagnostics. */
  unclamped: number[];
  /** Roster id -> index, so callers can look strengths up by player. */
  index: Map<string, number>;
  /** What the latent scale is centred on. */
  meanCurrent: number;
  /** Iterations actually used, and whether it settled. */
  iterations: number;
  converged: boolean;
};

export type BtOptions = {
  /** Shrinkage toward the existing ratings. Higher keeps players put. */
  lambda?: number;
  pointsPerUnit?: number;
  ratingMin?: number;
  ratingMax?: number;
  maxIterations?: number;
  step?: number;
};

/**
 * Gradient ascent on the penalised log-likelihood.
 *
 * A concave objective over as many parameters as there are players - there is
 * nothing here worth a fancier optimiser.
 */
export function fitBradleyTerry(
  roster: BtPlayer[],
  rows: BtComparison[],
  options: BtOptions = {},
): BtFit {
  const {
    lambda = 1,
    pointsPerUnit = POINTS_PER_UNIT,
    ratingMin = 65,
    ratingMax = 99,
    maxIterations = 20000,
    step = 0.05,
  } = options;

  const index = new Map(roster.map((p, i) => [p.id, i]));
  const n = roster.length;
  const meanCurrent =
    roster.reduce((sum, p) => sum + p.current, 0) / Math.max(1, n);
  const prior = roster.map((p) => (p.current - meanCurrent) / pointsPerUnit);

  const obs: { win: number; lose: number }[] = [];
  const appearances = new Array<number>(n).fill(0);
  for (const row of rows) {
    if (row.winnerId === null) continue;
    const w = index.get(row.winnerId);
    const l = index.get(
      row.winnerId === row.leftId ? row.rightId : row.leftId,
    );
    if (w === undefined || l === undefined) continue;
    obs.push({ win: w, lose: l });
    appearances[w]++;
    appearances[l]++;
  }

  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

  /*
   * The step has to shrink as the problem gets stiffer, in both directions.
   *
   * Gradient ascent is stable only while the step stays under 2/L, where L is
   * the largest curvature of the objective. Two things drive it here:
   *
   *  - The penalty contributes lambda. Each update multiplies the distance from
   *    the prior by (1 - step * lambda), a contraction only below step * lambda
   *    = 2. At the old fixed 0.05 that cliff sat at lambda 40, and since
   *    --lambda is a CLI flag with no bound, asking for heavy shrinkage
   *    silently produced NaN proposals rather than near-immovable ratings.
   *
   *  - The log-likelihood is a *sum* over comparisons, not a mean, so its
   *    curvature grows with how many a player appears in - at most a quarter
   *    per comparison. That is deliberate and statistically right: it is what
   *    lets a growing pile of data overcome a fixed prior. But it means the
   *    safe step shrinks as the data grows, and a fixed one eventually
   *    diverges. Measured on synthetic data at the old step: usable at 600
   *    comparisons, badly wrong at 4,000. Collection is at a few hundred and
   *    climbing, so this was a matter of time rather than a hypothetical.
   *
   * Bounding by the actual curvature covers both. At the volumes seen so far -
   * a couple of hundred comparisons at lambda 1-3 - it returns the same 0.05
   * the fit has always used, so nothing about today's numbers changes.
   */
  const maxAppearances = appearances.reduce((m, a) => Math.max(m, a), 0);
  const curvature = maxAppearances / 4 + lambda;
  const effectiveStep = Math.min(step, 1 / (curvature + 1));

  const s = [...prior];
  let iterations = 0;
  let converged = false;
  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;
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
      const delta = effectiveStep * grad[i];
      s[i] += delta;
      moved = Math.max(moved, Math.abs(delta));
    }
    // Only differences are identified, so the scale is pinned by centring.
    const mean = n > 0 ? s.reduce((a, b) => a + b, 0) / n : 0;
    for (let i = 0; i < n; i++) s[i] -= mean;
    if (moved < 1e-9) {
      converged = true;
      break;
    }
  }

  const unclamped = roster.map((_, i) => meanCurrent + s[i] * pointsPerUnit);
  const proposed = unclamped.map((raw) =>
    Math.round(Math.min(ratingMax, Math.max(ratingMin, raw))),
  );

  return {
    strengths: s,
    appearances,
    proposed,
    unclamped,
    index,
    meanCurrent,
    iterations,
    converged,
  };
}

/**
 * Share of comparisons where the higher current rating was the one picked.
 *
 * Low means this rater disagrees with the stored ratings.
 */
export function agreementWithCurrent(
  rows: BtComparison[],
  currentOf: Map<string, number>,
): number {
  let hits = 0;
  let total = 0;
  for (const row of rows) {
    const a = currentOf.get(row.leftId);
    const b = currentOf.get(row.rightId);
    if (a === undefined || b === undefined || a === b) continue;
    const favourite = a > b ? row.leftId : row.rightId;
    total++;
    if (row.winnerId === favourite) hits++;
  }
  return total === 0 ? NaN : hits / total;
}

/**
 * Share where the fitted consensus picked the same winner the rater did.
 *
 * The comparison that matters is this against `agreementWithCurrent`. If raters
 * agree with each other more than they agree with the stored ratings, the
 * stored ratings are the outlier - and that is the finding, not the new numbers.
 *
 * One caveat this cannot fix: a rater always agrees more with a consensus they
 * helped fit, and with two or three raters that effect alone can produce the
 * pattern. It means something once the panel is large enough that no single
 * rater moves the consensus much.
 */
export function agreementWithConsensus(
  rows: BtComparison[],
  strengthOf: Map<string, number>,
): number {
  let hits = 0;
  let total = 0;
  for (const row of rows) {
    const a = strengthOf.get(row.leftId);
    const b = strengthOf.get(row.rightId);
    if (a === undefined || b === undefined) continue;
    const favourite = a > b ? row.leftId : row.rightId;
    total++;
    if (row.winnerId === favourite) hits++;
  }
  return total === 0 ? NaN : hits / total;
}
