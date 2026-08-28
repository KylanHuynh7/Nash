/**
 * Pair selection for the comparison collector.
 *
 * Pure and side-effect free so it can be unit tested and so the picker can run
 * on the client without a round trip per question - a friend answering forty
 * questions on a phone should never wait on the network between two names.
 */

export type ComparePlayer = {
  id: string;
  name: string;
  /**
   * The current single-rater number on the axis being collected — the overall
   * for the "overall" axis, that attribute's rating for any other.
   *
   * Used only to *choose* questions, and never shown. It is called `estimate`
   * rather than `overall` because a throwing pass has to steer on the throwing
   * rating; a field named `overall` quietly holding a throwing number is the
   * kind of thing that gets discovered a year later.
   *
   * A brand-new group — or an axis nobody has rated, which is exactly what
   * `throwing` is — makes every value equal. That is the intended cold-start
   * behaviour, not a degenerate case: `informativeness` flattens to a constant
   * and selection falls back to coverage alone.
   */
  estimate: number;
};

export type Pair = { left: ComparePlayer; right: ComparePlayer };

/** Sorted ids joined, so a pair has one identity regardless of presentation. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Deterministic integer hash, for a seeded shuffle that survives SSR.
 *
 * `Math.sin` is the usual one-liner and it is not required to be identical
 * across implementations - the same trap that caused a hydration mismatch in
 * the shard field. Integer ops only.
 */
function hash(seed: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/**
 * How much a question is worth asking.
 *
 * Two players thirty points apart tell you almost nothing you did not already
 * know - everyone answers the same way and the answer moves no estimate. The
 * information is in the pairs that are close, which is why closeness dominates.
 *
 * It cannot dominate *completely*, though. A model fitted only on near-ties has
 * nothing anchoring the far ends of the scale to each other, so a floor of 0.3
 * keeps wide pairs in the sample.
 *
 * Note what this does and does not use. The current estimate picks *which
 * question to ask*; it is never shown to the rater and never enters the answer.
 * Steering the questions with a prior is ordinary active learning. Showing the
 * prior would be anchoring, and would contaminate the one independent signal
 * being collected.
 */
function informativeness(a: ComparePlayer, b: ComparePlayer): number {
  const gap = Math.abs(a.estimate - b.estimate);
  return 0.3 + 0.7 * Math.exp(-gap / 6);
}

/**
 * Weight that pulls the sample toward players who have been asked about least.
 *
 * Without it, uniform sampling leaves someone with four appearances and someone
 * else with twenty, and the model is confident about one and guessing about the
 * other. Coverage is worth more than any individual question.
 */
function coverage(seen: number): number {
  return 1 / (1 + seen);
}

/**
 * The pairs every rater is asked, before anything random.
 *
 * Two jobs at once.
 *
 * The adjacent pairs - each player against the one directly above him on the
 * current ladder - are the most informative questions available. A wide pair is
 * answered the same way by everyone and moves no estimate; the disagreement,
 * and therefore the information, lives between neighbours.
 *
 * They also give the raters a *shared* set of questions. With only four or five
 * people, random selection leaves barely any pair answered by two of them, and
 * inter-rater agreement is the single most valuable number this collection can
 * produce: if the group agrees with each other far more than they agree with
 * the existing ratings, the existing ratings are what is wrong. Measuring that
 * needs deliberate overlap, not overlap by chance.
 *
 * Three long-range pairs are added because a model fitted only on neighbours
 * has nothing tying the top of the ladder to the bottom.
 */
export function anchorPairs(pool: ComparePlayer[]): string[] {
  const ladder = [...pool].sort(
    (a, b) => b.estimate - a.estimate || (a.id < b.id ? -1 : 1),
  );
  const keys: string[] = [];
  for (let i = 0; i + 1 < ladder.length; i++) {
    keys.push(pairKey(ladder[i].id, ladder[i + 1].id));
  }
  const last = ladder.length - 1;
  const mid = Math.floor(last / 2);
  if (ladder.length >= 3) {
    keys.push(pairKey(ladder[0].id, ladder[last].id));
    keys.push(pairKey(ladder[0].id, ladder[mid].id));
    keys.push(pairKey(ladder[mid].id, ladder[last].id));
  }
  return [...new Set(keys)];
}

export type PickOptions = {
  pool: ComparePlayer[];
  /** Excluded from every pair: nobody usefully judges themselves. */
  raterId: string | null;
  /** Pair keys this rater has already answered, in this sitting or a past one. */
  answered: Set<string>;
  /** How many times each player has already come up for this rater. */
  seen: Record<string, number>;
  /** Advances once per question, so the sequence is reproducible. */
  seed: number;
  /** Served first, in a rater-specific order. See `anchorPairs`. */
  anchors?: string[];
};

/**
 * Picks the next pair, or null when the rater has exhausted every pair.
 *
 * Weighted sampling rather than "take the best pair": always asking the single
 * most informative question makes the sequence deterministic and clusters it on
 * the same few near-ties.
 */
export function nextPair(options: PickOptions): Pair | null {
  const { pool, raterId, answered, seen, seed, anchors } = options;
  const eligible = pool.filter((p) => p.id !== raterId);
  const byId = new Map(eligible.map((p) => [p.id, p]));

  // Anchors first, but not in ladder order - walking the ladder top to bottom
  // is a visible pattern, and a rater who spots it starts answering the pattern
  // instead of the question. Ordered by a rater-specific hash instead.
  if (anchors && anchors.length > 0) {
    const pending = anchors
      .filter((key) => !answered.has(key))
      .map((key) => {
        const [a, b] = key.split(":");
        return { key, a: byId.get(a), b: byId.get(b) };
      })
      .filter((x): x is { key: string; a: ComparePlayer; b: ComparePlayer } =>
        Boolean(x.a && x.b),
      );
    if (pending.length > 0) {
      pending.sort(
        (x, y) => hash(hashKey(x.key, raterId)) - hash(hashKey(y.key, raterId)),
      );
      const chosen = pending[0];
      const flipAnchor = hash(seed ^ 0x5f356495) < 0.5;
      return flipAnchor
        ? { left: chosen.a, right: chosen.b }
        : { left: chosen.b, right: chosen.a };
    }
  }

  const candidates: { a: ComparePlayer; b: ComparePlayer; weight: number }[] = [];
  let total = 0;
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const a = eligible[i];
      const b = eligible[j];
      if (answered.has(pairKey(a.id, b.id))) continue;
      const weight =
        informativeness(a, b) *
        coverage(seen[a.id] ?? 0) *
        coverage(seen[b.id] ?? 0);
      candidates.push({ a, b, weight });
      total += weight;
    }
  }
  if (candidates.length === 0) return null;

  let roll = hash(seed) * total;
  let chosen = candidates[candidates.length - 1];
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) {
      chosen = candidate;
      break;
    }
  }

  // Presentation order is randomised so a side preference shows up as noise
  // across the whole sample rather than as a consistent tilt toward whoever the
  // picker happened to name first.
  const flip = hash(seed ^ 0x5f356495) < 0.5;
  return flip
    ? { left: chosen.a, right: chosen.b }
    : { left: chosen.b, right: chosen.a };
}

/**
 * The seed for one question, from the rater and how many they have answered.
 *
 * Deterministic rather than random on purpose. A reload refetches which pairs
 * this rater has already answered, so those are excluded either way - which
 * means randomness buys nothing, and determinism costs nothing while removing
 * a whole class of hydration hazard from a server-rendered component.
 */
export function seedFor(raterId: string | null, count: number): number {
  return hashKey(`q${count}`, raterId);
}

/** Stable per-rater ordering seed for a pair, so the anchor order is fixed. */
function hashKey(key: string, raterId: string | null): number {
  let h = 0;
  const text = `${key}|${raterId ?? ""}`;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) | 0;
  }
  return h;
}

/**
 * How many questions one sitting asks for.
 *
 * Sixty rather than forty because the panel is small. With four raters the
 * estimate is limited by how few independent opinions there are, not by how
 * many questions each one answered - but questions are nearly free (about four
 * seconds each) and more of them tighten every individual estimate, so there is
 * no reason to leave them uncollected.
 */
export const SESSION_TARGET = 60;

/**
 * How many questions this rater could answer at most.
 *
 * Every pair of everyone except themselves. It matters because the target is
 * not always reachable: football's roster is twelve, so a rater has 55 pairs
 * and a flat target of 60 would count toward a number they cannot arrive at.
 */
export function availablePairs(poolSize: number, hasRater: boolean): number {
  const n = Math.max(0, poolSize - (hasRater ? 1 : 0));
  return (n * (n - 1)) / 2;
}
