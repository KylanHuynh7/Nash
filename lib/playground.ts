/**
 * The weights playground: re-rank the roster under weights someone is trying
 * out, without any of it reaching the official ratings.
 *
 * Nothing here writes. The sandbox is a pure function of the stored ratings and
 * a set of family weights held in the browser (and, when shared, in the URL).
 * Changing the official weights stays what it always was - a config change and
 * a rewrite of every stored overall, done on purpose by a person.
 *
 * Weights are moved per FAMILY, not per attribute. That is the level the player
 * card prints and the level the group argues at ("threes should count more"),
 * and a per-attribute weight after the split is arithmetically true and
 * communicatively false - see the families note in PlayerCard. A family slider
 * scales every child by the same factor, so the children keep their official
 * proportions to each other and an untouched board reproduces `computeOverall`
 * exactly: `w * (b / b)` is `w`.
 */
import { competitionRanks, type Ranked } from "./rank";
import { RATING_DEFAULT, RATING_MAX, RATING_MIN, type SportConfig } from "./sports";

export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 3;
export const WEIGHT_STEP = 0.05;

export type Family = {
  name: string;
  /** URL-safe name, used in a shared link. */
  slug: string;
  /** The official weight: the sum of its attributes' weights. */
  weight: number;
};

/** Family name -> weight. */
export type FamilyWeights = Record<string, number>;

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The families that feed the overall, heaviest first, matching the card.
 *
 * An attribute priced elsewhere (`inOverall: false`) is left out entirely: a
 * slider for it would move nothing, which reads as broken.
 */
export function families(config: SportConfig): Family[] {
  const byName = new Map<string, Family>();
  for (const attr of config.attributes) {
    if (attr.inOverall === false) continue;
    const name = attr.group ?? attr.label;
    const family = byName.get(name) ?? { name, slug: slugify(name), weight: 0 };
    family.weight += attr.weight;
    byName.set(name, family);
  }
  return [...byName.values()].sort((a, b) => b.weight - a.weight);
}

export function officialWeights(config: SportConfig): FamilyWeights {
  return Object.fromEntries(families(config).map((f) => [f.name, f.weight]));
}

/** Whether any family has been moved off its official weight. */
export function isChanged(config: SportConfig, weights: FamilyWeights): boolean {
  return families(config).some(
    (f) => Math.abs((weights[f.name] ?? f.weight) - f.weight) > 1e-9,
  );
}

/**
 * A player's overall under the sandbox weights, rounded and clamped exactly as
 * `computeOverall` does. Null when every weight is zero - there is no mean of
 * nothing, and printing the default 80 for everyone would look like an answer.
 */
export function sandboxOverall(
  config: SportConfig,
  ratings: Record<string, number>,
  weights: FamilyWeights,
): number | null {
  const official = officialWeights(config);
  let total = 0;
  let weight = 0;
  for (const attr of config.attributes) {
    if (attr.inOverall === false) continue;
    const name = attr.group ?? attr.label;
    const base = official[name];
    const chosen = weights[name] ?? base;
    const w = base > 0 ? attr.weight * (chosen / base) : 0;
    total += (ratings[attr.key] ?? RATING_DEFAULT) * w;
    weight += w;
  }
  if (weight <= 0) return null;
  return Math.round(Math.min(RATING_MAX, Math.max(RATING_MIN, total / weight)));
}

export type PlaygroundPlayer = {
  id: string;
  name: string;
  overall: number;
  ratings: Record<string, number>;
};

export type PlaygroundRow<P extends PlaygroundPlayer = PlaygroundPlayer> = {
  player: P;
  official: number;
  officialRank: Ranked;
  sandbox: number;
  sandboxRank: Ranked;
  /** Places gained under the sandbox. Positive is up the list. */
  moved: number;
};

/**
 * The roster in sandbox order, each row carrying where it officially stands.
 *
 * Both orders break ties by name, and both ranks come from `competitionRanks`,
 * so a tie is a shared rank on either side and "moved" never reports an order
 * the ratings did not compute. Null when every weight is zero.
 */
export function playgroundBoard<P extends PlaygroundPlayer>(
  config: SportConfig,
  roster: P[],
  weights: FamilyWeights,
): PlaygroundRow<P>[] | null {
  const byName = (a: P, b: P) => a.name.localeCompare(b.name);

  const officialOrder = [...roster].sort(
    (a, b) => b.overall - a.overall || byName(a, b),
  );
  const officialRanks = competitionRanks(officialOrder.map((p) => p.overall));
  const officialRankOf = new Map(
    officialOrder.map((p, i) => [p.id, officialRanks[i]]),
  );

  const scored: { player: P; sandbox: number }[] = [];
  for (const player of roster) {
    const sandbox = sandboxOverall(config, player.ratings, weights);
    if (sandbox === null) return null;
    scored.push({ player, sandbox });
  }
  scored.sort((a, b) => b.sandbox - a.sandbox || byName(a.player, b.player));
  const sandboxRanks = competitionRanks(scored.map((s) => s.sandbox));

  return scored.map(({ player, sandbox }, i) => {
    const officialRank = officialRankOf.get(player.id)!;
    return {
      player,
      official: player.overall,
      officialRank,
      sandbox,
      sandboxRank: sandboxRanks[i],
      moved: officialRank.rank - sandboxRanks[i].rank,
    };
  });
}

/**
 * Weights as a short, readable URL value: only the families that moved,
 * `shooting-1.5_defense-0.8`. Empty when nothing moved, so an untouched board
 * shares as the plain page. Characters chosen so URLSearchParams leaves them
 * unescaped.
 */
export function encodeWeights(config: SportConfig, weights: FamilyWeights): string {
  return families(config)
    .filter((f) => Math.abs((weights[f.name] ?? f.weight) - f.weight) > 1e-9)
    .map((f) => `${f.slug}-${Number((weights[f.name] ?? f.weight).toFixed(2))}`)
    .join("_");
}

/**
 * The inverse, forgiving on purpose: a link is typed by hand or mangled by a
 * chat app, and a bad fragment should drop that one family back to official
 * rather than refuse the whole page. Values snap to the slider's step and range.
 * Null when nothing valid moved.
 */
export function decodeWeights(
  config: SportConfig,
  value: string,
): FamilyWeights | null {
  const weights = officialWeights(config);
  const bySlug = new Map(families(config).map((f) => [f.slug, f]));
  for (const part of value.split("_")) {
    const match = /^([a-z0-9]+)-(\d+(?:\.\d+)?)$/.exec(part.trim());
    if (!match) continue;
    const family = bySlug.get(match[1]);
    if (!family) continue;
    const raw = Number(match[2]);
    if (!Number.isFinite(raw)) continue;
    const clamped = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, raw));
    weights[family.name] = Number(
      (Math.round(clamped / WEIGHT_STEP) * WEIGHT_STEP).toFixed(2),
    );
  }
  return isChanged(config, weights) ? weights : null;
}
