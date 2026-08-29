/**
 * Badges — derived at display time, never stored.
 *
 * The one rule the whole file exists to keep (context.md 2c, 6i): **a badge
 * never modifies an attribute or the overall.** Every badge here is a pure
 * function of ratings that already exist, so the double-counting trap — a
 * Sniper badge raising shooting, which then re-earns Sniper — cannot occur.
 * Nothing in this module writes.
 *
 * Three families, after 6i:
 *
 *   Attribute    absolute threshold, four tiers   "he is good at this"
 *   Signature    standardised residual >= 1.0sd   "this is who he is"
 *   Combination  AND/OR across attributes         a playing style
 *
 * Written against the FIFTEEN-attribute config, not the nine 6i was first
 * drafted on. Four of that draft's nine — Shooting, Finishing, Playmaking,
 * Rebounding — stopped being attributes when the second split landed and are
 * now families of two. Keying badges to them would have named things the
 * config no longer has.
 */
import { RATING_MAX, RATING_MIN, computeOverall, type SportConfig } from "./sports";

export type BadgeTier = "bronze" | "silver" | "gold" | "hof";

/**
 * Tiers sit on Nash's own 65-99 band, not on 2K's numbers (6b).
 *
 * 2K's Bronze Deadeye wants 65 three-point — a below-average professional. Here
 * 65 is the floor of the group, so copying that number badges all seventeen.
 * What transfers from 2K is percentile, names, tier count and the OR/AND
 * pattern. Never its thresholds.
 */
export const TIERS: ReadonlyArray<{ key: BadgeTier; label: string; min: number }> = [
  { key: "bronze", label: "Bronze", min: 76 },
  { key: "silver", label: "Silver", min: 84 },
  { key: "gold", label: "Gold", min: 91 },
  { key: "hof", label: "Hall of Fame", min: 96 },
];

const CUT = {
  B: 76,
  S: 84,
  G: 91,
  H: 96,
} as const;

/** How lopsided a player must be, in standard deviations, to sign an attribute. */
export const SIGNATURE_SD = 1.0;

export type BadgeFamily = "attribute" | "signature" | "combination";

export type Badge = {
  key: string;
  name: string;
  family: BadgeFamily;
  /** Only the attribute family is tiered; the other two are held or not. */
  tier?: BadgeTier;
  /** What the badge says, in words, for the card. */
  blurb: string;
  /** Which attributes produced it — for showing the evidence behind a badge. */
  attributes: string[];
  /**
   * How far past the bar this one was earned, standardised where that means
   * something. Used only to rank which badges the card features.
   */
  score: number;
};

/* ------------------------------------------------------------------ *
 * The catalogue
 * ------------------------------------------------------------------ */

/**
 * One tiered badge per attribute. Eleven of the fifteen take a real 2K name;
 * the rest are named in its idiom.
 *
 * The split is what made this list possible. 6c measured the old ceiling — "a
 * situational badge needs a situational attribute, and we cannot tell
 * catch-and-shoot from off-dribble while shooting is one number" — and
 * mid_range against three_point is exactly the Static Middy / Limitless Range
 * distinction 2K draws off two shooting ratings.
 */
const ATTRIBUTE_BADGES: ReadonlyArray<{
  attribute: string;
  name: string;
  blurb: string;
}> = [
  { attribute: "speed", name: "Flash", blurb: "gets there first" },
  { attribute: "strength", name: "Bruiser", blurb: "wins the physical exchange" },
  { attribute: "stamina", name: "Work Horse", blurb: "still going at 9-9" },
  { attribute: "driving_layup", name: "Slasher", blurb: "finishes at the rim" },
  { attribute: "post_control", name: "Back to the Basket", blurb: "scores off the block" },
  { attribute: "def_reb", name: "Boxout Boss", blurb: "ends the possession" },
  { attribute: "off_reb", name: "Second Chance", blurb: "keeps it alive" },
  { attribute: "perimeter_d", name: "Clamps", blurb: "stays in front" },
  { attribute: "interior_d", name: "Rim Protector", blurb: "holds the paint" },
  { attribute: "steal", name: "Interceptor", blurb: "reads the pass" },
  { attribute: "block", name: "Challenger", blurb: "meets it at the top" },
  { attribute: "mid_range", name: "Static Middy", blurb: "kills you from fifteen" },
  { attribute: "three_point", name: "Limitless Range", blurb: "shoots it from deep" },
  { attribute: "pass_accuracy", name: "Dimer", blurb: "puts it on target" },
  { attribute: "ball_handle", name: "Handles", blurb: "gets where he wants" },
];

/**
 * The one-way player's family. Untiered on purpose: a signature is a shape, and
 * a shape is not more or less true (6i).
 */
const SIGNATURE_BADGES: ReadonlyArray<{
  attribute: string;
  name: string;
  blurb: string;
}> = [
  { attribute: "speed", name: "Blur", blurb: "quicker than his level" },
  { attribute: "strength", name: "Brick Wall", blurb: "stronger than his level" },
  { attribute: "stamina", name: "Motor", blurb: "never stops" },
  { attribute: "driving_layup", name: "Crafty", blurb: "finishes above his level" },
  { attribute: "post_control", name: "Old Man Game", blurb: "scores on the block above his level" },
  { attribute: "def_reb", name: "Vacuum", blurb: "rebounds above his size" },
  { attribute: "off_reb", name: "Relentless", blurb: "chases his own miss" },
  { attribute: "perimeter_d", name: "Pest", blurb: "guards above his level" },
  { attribute: "interior_d", name: "Wall", blurb: "holds the paint above his size" },
  { attribute: "steal", name: "Pickpocket", blurb: "hands above his level" },
  { attribute: "block", name: "Denial", blurb: "blocks above his size" },
  { attribute: "mid_range", name: "Pull-Up", blurb: "lives in the middle" },
  { attribute: "three_point", name: "Deadeye", blurb: "shoots better than he plays" },
  { attribute: "pass_accuracy", name: "Quarterback", blurb: "sees it better than he plays" },
  { attribute: "ball_handle", name: "Shifty", blurb: "handles above his level" },
];

type Clause = { all?: string[][]; any?: string[][] };

/**
 * Playing styles. Top-heavy by construction and that is accepted (6c) — AND
 * conditions compound, so the rare ones stay rare and reach is what the other
 * two families are for.
 *
 * Three of these were *attribute* badges in the nine-attribute draft and became
 * combinations when their component split: Floor General is now passing AND
 * handles, Glass Cleaner is both boards, and Three Level is the badge the
 * shooting split bought outright.
 */
const COMBINATION_BADGES: ReadonlyArray<{
  name: string;
  blurb: string;
  requires: Clause;
}> = [
  { name: "Two-Way", blurb: "guards and scores", requires: { all: [["perimeter_d", "S"]], any: [["three_point", "S"], ["driving_layup", "S"]] } },
  { name: "Glue Guy", blurb: "does the unglamorous parts", requires: { all: [["perimeter_d", "B"], ["def_reb", "B"], ["stamina", "S"]] } },
  { name: "Floor General", blurb: "runs the team", requires: { all: [["pass_accuracy", "S"], ["ball_handle", "S"]] } },
  { name: "Glass Cleaner", blurb: "owns both glasses", requires: { all: [["def_reb", "S"], ["off_reb", "S"]] } },
  { name: "Three Level", blurb: "scores from all three levels", requires: { all: [["three_point", "S"], ["mid_range", "S"], ["driving_layup", "S"]] } },
  { name: "Point Forward", blurb: "brings it up and boards", requires: { all: [["pass_accuracy", "S"], ["def_reb", "S"]] } },
  { name: "Iron Man", blurb: "never comes off", requires: { all: [["stamina", "G"], ["speed", "S"]] } },
  { name: "Bully Ball", blurb: "scores through contact", requires: { all: [["strength", "G"], ["post_control", "S"]] } },
  { name: "Rim Runner", blurb: "runs the floor and finishes", requires: { all: [["speed", "G"], ["driving_layup", "G"]] } },
  { name: "Microwave", blurb: "scores from anywhere", requires: { all: [["three_point", "G"], ["driving_layup", "G"]] } },
  { name: "Lockdown", blurb: "takes the best guard", requires: { all: [["perimeter_d", "G"], ["speed", "S"]] } },
  { name: "Ball Hawk", blurb: "gambles and wins", requires: { all: [["steal", "G"], ["perimeter_d", "S"]] } },
  { name: "Anchor", blurb: "holds the paint", requires: { all: [["interior_d", "G"], ["def_reb", "G"]] } },
  { name: "Stretch Big", blurb: "boards and shoots", requires: { all: [["def_reb", "S"], ["three_point", "S"]] } },
  { name: "Engine", blurb: "pushes it all game", requires: { all: [["speed", "G"], ["pass_accuracy", "S"]] } },
  { name: "Closer", blurb: "still shooting at 9-9", requires: { all: [["three_point", "G"], ["stamina", "G"]] } },
  { name: "Immovable", blurb: "cannot be moved off a spot", requires: { all: [["strength", "G"], ["interior_d", "S"]] } },
  { name: "Chase-Down", blurb: "blocks it from behind", requires: { all: [["speed", "G"], ["block", "S"]] } },
];

/** Every attribute at Bronze. Stated separately because it names no attributes. */
const SWISS_ARMY = { name: "Swiss Army", blurb: "no holes anywhere" };

/* ------------------------------------------------------------------ *
 * Derivation
 * ------------------------------------------------------------------ */

export function tierFor(value: number): BadgeTier | null {
  let held: BadgeTier | null = null;
  for (const tier of TIERS) if (value >= tier.min) held = tier.key;
  return held;
}

export function tierLabel(tier: BadgeTier): string {
  return TIERS.find((t) => t.key === tier)?.label ?? tier;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * How lopsided each player is toward each attribute, in standard deviations.
 *
 * The residual is `rating - overall`: how far above his own level he sits on
 * this one attribute. Standardising it *per attribute across the roster* is
 * what makes the comparison fair — people are normally lopsided toward some
 * attributes more than others, and a raw residual would hand every badge to
 * whichever attribute happens to run hot group-wide.
 *
 * Returned as a map so a caller can derive one player's badges without
 * recomputing the roster's statistics for each of them.
 */
export function residualStats(
  config: SportConfig,
  roster: ReadonlyArray<{ ratings: Record<string, number> }>,
): Map<string, { mean: number; sd: number }> {
  const stats = new Map<string, { mean: number; sd: number }>();
  for (const attr of config.attributes) {
    const residuals = roster.map((p) => {
      const overall = computeOverall(config, p.ratings);
      return (p.ratings[attr.key] ?? RATING_MIN) - overall;
    });
    const n = residuals.length;
    if (n === 0) {
      stats.set(attr.key, { mean: 0, sd: 0 });
      continue;
    }
    const mean = residuals.reduce((s, r) => s + r, 0) / n;
    const variance = residuals.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
    stats.set(attr.key, { mean, sd: Math.sqrt(variance) });
  }
  return stats;
}

/**
 * Every badge one player holds, most impressive first.
 *
 * `roster` is needed only for the signature family, which is relative by
 * definition. Pass the whole sport's roster; passing the players on the court
 * would quietly redefine "unusual" as "unusual among these five".
 */
export function deriveBadges(
  config: SportConfig,
  ratings: Record<string, number>,
  roster: ReadonlyArray<{ ratings: Record<string, number> }>,
  stats: Map<string, { mean: number; sd: number }> = residualStats(config, roster),
): Badge[] {
  const has = new Set(config.attributes.map((a) => a.key));
  const value = (key: string) => ratings[key] ?? RATING_MIN;
  const badges: Badge[] = [];

  for (const spec of ATTRIBUTE_BADGES) {
    if (!has.has(spec.attribute)) continue;
    const tier = tierFor(value(spec.attribute));
    if (!tier) continue;
    badges.push({
      key: `attr_${spec.attribute}`,
      name: spec.name,
      family: "attribute",
      tier,
      blurb: spec.blurb,
      attributes: [spec.attribute],
      // Distance past the bar, on the band's own scale.
      score: (value(spec.attribute) - CUT.B) / (RATING_MAX - CUT.B),
    });
  }

  const overall = computeOverall(config, ratings);
  for (const spec of SIGNATURE_BADGES) {
    if (!has.has(spec.attribute)) continue;
    const stat = stats.get(spec.attribute);
    // A zero spread means every player is lopsided identically, which is not a
    // signature — it is a constant. Awarding it would badge all seventeen.
    if (!stat || stat.sd === 0) continue;
    const z = (value(spec.attribute) - overall - stat.mean) / stat.sd;
    if (z < SIGNATURE_SD) continue;
    badges.push({
      key: `sig_${spec.attribute}`,
      name: spec.name,
      family: "signature",
      blurb: spec.blurb,
      attributes: [spec.attribute],
      score: z,
    });
  }

  const meets = ([key, cut]: string[]) =>
    has.has(key) && value(key) >= CUT[cut as keyof typeof CUT];

  for (const spec of COMBINATION_BADGES) {
    const all = spec.requires.all ?? [];
    const any = spec.requires.any ?? [];
    // A clause naming an attribute this sport does not have can never be met,
    // rather than being skipped as vacuously true.
    if (!all.every(meets)) continue;
    if (any.length > 0 && !any.some(meets)) continue;
    const named = [...all, ...any].map(([key]) => key);
    badges.push({
      key: `combo_${slug(spec.name)}`,
      name: spec.name,
      family: "combination",
      blurb: spec.blurb,
      attributes: named,
      // The weakest link is what the badge actually cost to earn.
      score: Math.min(...named.filter((k) => has.has(k)).map((k) => value(k))) / RATING_MAX,
    });
  }

  if (config.attributes.every((a) => value(a.key) >= CUT.B)) {
    badges.push({
      key: `combo_${slug(SWISS_ARMY.name)}`,
      name: SWISS_ARMY.name,
      family: "combination",
      blurb: SWISS_ARMY.blurb,
      attributes: config.attributes.map((a) => a.key),
      score: Math.min(...config.attributes.map((a) => value(a.key))) / RATING_MAX,
    });
  }

  return badges.sort((a, b) => rank(b) - rank(a));
}

/**
 * Which badges the card features (6i: "the card shows the best three").
 *
 * Signature badges are ranked above equivalent attribute badges on purpose —
 * 6a's whole finding was that the standardised residual separates "he is good
 * at this" from "this is who he is", and the second is the more interesting
 * thing to put on a card. The full list stays available; an accomplishment
 * should not evaporate because three others outranked it.
 */
function rank(badge: Badge): number {
  const tierWeight: Record<BadgeTier, number> = {
    hof: 4,
    gold: 3,
    silver: 2,
    bronze: 1,
  };
  if (badge.family === "signature") return 3.5 + Math.min(badge.score, 3) / 10;
  if (badge.family === "combination") return 3.2 + badge.score / 10;
  return tierWeight[badge.tier ?? "bronze"] + badge.score / 10;
}

export function featured(badges: Badge[], count = 3): Badge[] {
  return badges.slice(0, count);
}
