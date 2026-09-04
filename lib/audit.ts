/**
 * Attribute-sheet diagnostics: does this rating sheet measure what it claims?
 *
 * Pure and database-free, like `bt.ts` and for the same reason - the script
 * that drives this has a live connection at module scope, and every
 * environment shares one database.
 *
 * Why this exists
 * ---------------
 * A hand-rated sheet has failure modes that no amount of staring at it will
 * surface, because they are properties of the *columns* rather than of any one
 * player:
 *
 *  - **A column that is a copy of another.** Two attributes that rank everyone
 *    identically are one attribute charged twice, and the overall pays for it
 *    in whatever weight they carry between them. Found here as a correlation
 *    near 1 (context.md 6aa, where `after the catch` sat at +0.99 against
 *    `quickness`).
 *  - **A ladder fill.** Filling a column from a draft order hands its ceiling
 *    to whoever ranks first overall and leaves ties in its wake, so a value
 *    shared by three or more players is a signature worth checking (6w).
 *  - **Fewer real dimensions than columns.** Eleven attributes that collapse
 *    onto four components are a presentation choice, not a measurement, and
 *    weights spent inside one cluster are spent on the same signal repeatedly.
 *  - **Weights that change nothing.** A weight table only matters where
 *    attributes disagree. On a roster where they mostly agree, a carefully
 *    argued set of weights and a flat mean produce the same board - and it is
 *    better to know that than to keep tuning it.
 *  - **Adjacent players the sheet cannot separate.** A gap of a quarter point
 *    is not a ranking, and saying so is more honest than printing an order.
 *
 * Every function here answers one of those, takes plain numbers, and is
 * deterministic given its inputs.
 */

/**
 * Ratings in column-major intent but row-major storage: `values[player][key]`,
 * matching how a roster is actually iterated.
 */
export type AuditMatrix = {
  /** Attribute keys, defining column order. */
  keys: string[];
  /** Player names, defining row order. */
  names: string[];
  /** `values[i][j]` is player `i`'s rating on attribute `keys[j]`. */
  values: number[][];
};

/** Build a matrix from per-player rating records, skipping absent keys as 0. */
export function buildMatrix(
  keys: string[],
  rows: { name: string; ratings: Record<string, number> }[],
): AuditMatrix {
  return {
    keys,
    names: rows.map((r) => r.name),
    values: rows.map((r) => keys.map((k) => r.ratings[k] ?? 0)),
  };
}

/** One attribute's column. */
export function column(m: AuditMatrix, key: string): number[] {
  const j = m.keys.indexOf(key);
  if (j < 0) throw new Error(`no such attribute: ${key}`);
  return m.values.map((row) => row[j]);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Population standard deviation - the roster IS the population here. */
function sd(xs: number[]): number {
  const mu = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - mu) ** 2)));
}

/**
 * Pearson correlation. Null when either side is constant, because a column
 * where everyone is identical has no order to agree or disagree with - which
 * is a finding in itself rather than a zero.
 */
export function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length) throw new Error("length mismatch");
  const sx = sd(xs);
  const sy = sd(ys);
  if (sx === 0 || sy === 0) return null;
  const mx = mean(xs);
  const my = mean(ys);
  const cov = mean(xs.map((x, i) => (x - mx) * (ys[i] - my)));
  return cov / (sx * sy);
}

/** Every attribute pair, most correlated first. Null pairs are omitted. */
export function correlationPairs(
  m: AuditMatrix,
): { a: string; b: string; r: number }[] {
  const out: { a: string; b: string; r: number }[] = [];
  for (let i = 0; i < m.keys.length; i++) {
    for (let j = i + 1; j < m.keys.length; j++) {
      const r = pearson(column(m, m.keys[i]), column(m, m.keys[j]));
      if (r !== null) out.push({ a: m.keys[i], b: m.keys[j], r });
    }
  }
  return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
}

/**
 * Each attribute against an outside vector - the overall, usually.
 *
 * Read together with the weights: an attribute that tracks the overall closely
 * *and* carries a heavy weight is amplifying the existing order rather than
 * contributing to it.
 */
export function correlationWith(
  m: AuditMatrix,
  target: number[],
): { key: string; r: number | null }[] {
  return m.keys.map((key) => ({ key, r: pearson(column(m, key), target) }));
}

/**
 * What one column says that another does not: the residuals of `y` regressed
 * on `x`, and their spread.
 *
 * **This is the measure to judge a redundant column by, not correlation.**
 * Correlation is capped by how correlated the inputs are - on a roster where
 * speed and quickness already agree at +0.84, an honest third column built
 * from them cannot help but look like both. The residual is the part that is
 * genuinely new, and it can improve while the correlation barely moves
 * (context.md 6aa: r 0.99 -> 0.96 while the residual spread went 4.6 -> 8.7).
 */
export function residuals(
  y: number[],
  x: number[],
): { residuals: number[]; spread: number } {
  const r = pearson(y, x);
  if (r === null) return { residuals: y.map(() => 0), spread: 0 };
  const slope = (r * sd(y)) / sd(x);
  const intercept = mean(y) - slope * mean(x);
  const res = y.map((v, i) => v - (intercept + slope * x[i]));
  return { residuals: res, spread: Math.max(...res) - Math.min(...res) };
}

/**
 * Values held by `minCount` or more players on the same attribute.
 *
 * A tie is only the ladder-fill signature when the tied players have nothing
 * in common - four non-throwers sharing the floor of `throwing` is the column
 * being honest. This reports; it does not judge.
 */
export function sharedValues(
  m: AuditMatrix,
  minCount = 3,
): { key: string; value: number; names: string[] }[] {
  const out: { key: string; value: number; names: string[] }[] = [];
  m.keys.forEach((key, j) => {
    const byValue = new Map<number, string[]>();
    m.values.forEach((row, i) => {
      const held = byValue.get(row[j]) ?? [];
      held.push(m.names[i]);
      byValue.set(row[j], held);
    });
    for (const [value, names] of byValue) {
      if (names.length >= minCount) out.push({ key, value, names });
    }
  });
  return out.sort((a, b) => b.names.length - a.names.length || a.key.localeCompare(b.key));
}

/**
 * Principal components of the *correlation* matrix, largest first.
 *
 * Correlation rather than covariance because the attributes share a scale but
 * not a spread, and a component driven by whichever column happens to be most
 * spread out would say nothing about skill.
 *
 * Solved by cyclic Jacobi rotation. The matrix is one attribute square - a
 * dozen at most - so an exact, dependency-free solver is the right call over
 * pulling in a linear algebra package for a 12x12.
 *
 * A constant column standardises to all-zeros rather than dividing by zero: it
 * loads on nothing and contributes no variance, which is the honest treatment
 * of a column with no order in it.
 */
export function principalComponents(m: AuditMatrix): {
  /** Share of total variance, per component, summing to 1. */
  variance: number[];
  /** `loadings[c][j]` is attribute `keys[j]`'s loading on component `c`. */
  loadings: number[][];
} {
  const n = m.keys.length;
  const z = m.keys.map((key) => {
    const col = column(m, key);
    const s = sd(col);
    const mu = mean(col);
    return s === 0 ? col.map(() => 0) : col.map((v) => (v - mu) / s);
  });

  // Correlation matrix.
  const a: number[][] = z.map((zi) =>
    z.map((zj) => mean(zi.map((v, k) => v * zj[k]))),
  );
  // Accumulated rotations become the eigenvectors.
  const v: number[][] = a.map((_, i) => a.map((__, j) => (i === j ? 1 : 0)));

  for (let sweep = 0; sweep < 100; sweep++) {
    let p = 0;
    let q = 1;
    let off = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(a[i][j]) > off) {
          off = Math.abs(a[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (off < 1e-12) break;

    const theta = 0.5 * Math.atan2(2 * a[p][q], a[p][p] - a[q][q]);
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    for (let k = 0; k < n; k++) {
      const akp = a[k][p];
      const akq = a[k][q];
      a[k][p] = c * akp + s * akq;
      a[k][q] = -s * akp + c * akq;
    }
    for (let k = 0; k < n; k++) {
      const apk = a[p][k];
      const aqk = a[q][k];
      a[p][k] = c * apk + s * aqk;
      a[q][k] = -s * apk + c * aqk;
    }
    for (let k = 0; k < n; k++) {
      const vkp = v[k][p];
      const vkq = v[k][q];
      v[k][p] = c * vkp + s * vkq;
      v[k][q] = -s * vkp + c * vkq;
    }
  }

  const eigen = a
    .map((row, i) => ({ value: Math.max(row[i], 0), index: i }))
    .sort((x, y) => y.value - x.value);
  const total = eigen.reduce((sum, e) => sum + e.value, 0) || 1;

  return {
    variance: eigen.map((e) => e.value / total),
    loadings: eigen.map((e) => v.map((row) => row[e.index])),
  };
}

/** How many components are needed to reach `share` of the variance. */
export function componentsToReach(variance: number[], share: number): number {
  let sum = 0;
  for (let i = 0; i < variance.length; i++) {
    sum += variance[i];
    if (sum >= share) return i + 1;
  }
  return variance.length;
}

/** A weighted mean per player, in roster order. */
export function weightedScores(
  m: AuditMatrix,
  weights: Record<string, number>,
): { name: string; score: number }[] {
  const total = m.keys.reduce((s, k) => s + (weights[k] ?? 0), 0);
  return m.names.map((name, i) => ({
    name,
    score: m.keys.reduce((s, k, j) => s + m.values[i][j] * (weights[k] ?? 0), 0) / total,
  }));
}

/** Names best-first. Ties break by name so an order is never arbitrary. */
export function orderOf(scores: { name: string; score: number }[]): string[] {
  return [...scores]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((s) => s.name);
}

/**
 * How much of the board the weight table is actually responsible for.
 *
 * Compares the weighted order against a flat mean, then jitters the weights to
 * find which *adjacent* pairs the sheet cannot hold apart. A pair that
 * reverses under a jitter smaller than the disagreement between two honest
 * raters is not a ranking, and reporting it as one is the thing this catches.
 */
export function weightSensitivity(
  m: AuditMatrix,
  weights: Record<string, number>,
  options: { rng: () => number; trials?: number; amount?: number },
): {
  /** Correlation between the weighted score and a flat unweighted mean. */
  flatCorrelation: number | null;
  /** Largest gap between weighted and flat score, in rating points. */
  flatMaxDelta: number;
  /** Whether weighting changes the order at all. */
  flatOrderIdentical: boolean;
  /** Adjacent pairs in weighted order, and how often jitter reverses them. */
  pairs: { a: string; b: string; gap: number; reversed: number }[];
} {
  const trials = options.trials ?? 2000;
  const amount = options.amount ?? 0.35;

  const weighted = weightedScores(m, weights);
  const flat = weightedScores(m, Object.fromEntries(m.keys.map((k) => [k, 1])));
  const order = orderOf(weighted);
  const byName = new Map(weighted.map((s) => [s.name, s.score]));

  const reversals = new Map<string, number>();
  for (let t = 0; t < trials; t++) {
    const jittered = Object.fromEntries(
      m.keys.map((k) => [k, Math.max(0.1, (weights[k] ?? 0) + (options.rng() * 2 - 1) * amount)]),
    );
    const drawn = orderOf(weightedScores(m, jittered));
    const rank = new Map(drawn.map((name, i) => [name, i]));
    for (let i = 0; i < order.length - 1; i++) {
      const a = order[i];
      const b = order[i + 1];
      if (rank.get(a)! > rank.get(b)!) {
        const key = `${a} ${b}`;
        reversals.set(key, (reversals.get(key) ?? 0) + 1);
      }
    }
  }

  return {
    flatCorrelation: pearson(
      weighted.map((s) => s.score),
      flat.map((s) => s.score),
    ),
    flatMaxDelta: Math.max(
      ...weighted.map((s, i) => Math.abs(s.score - flat[i].score)),
    ),
    flatOrderIdentical: orderOf(flat).join() === order.join(),
    pairs: order.slice(0, -1).map((a, i) => {
      const b = order[i + 1];
      return {
        a,
        b,
        gap: byName.get(a)! - byName.get(b)!,
        reversed: (reversals.get(`${a} ${b}`) ?? 0) / trials,
      };
    }),
  };
}
