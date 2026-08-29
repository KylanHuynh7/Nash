export type SportId = "basketball" | "football";

export type Attribute = {
  key: string;
  label: string;
  /** Short hint shown under the slider when editing. */
  hint: string;
  /** Relative contribution to the overall rating. */
  weight: number;
  /**
   * Display grouping, after 2K's player card — several attributes under one
   * heading. Purely presentational: the overall is a flat weighted mean over
   * the attributes themselves, and a group carries no weight of its own.
   */
  group?: string;
};

/**
 * A question the comparison collector can ask.
 *
 * "Who'd you rather have" is the first axis and carries most of the signal, so
 * extra axes earn their place only when they are genuinely independent of it.
 * Shooting, finishing and playmaking correlate at 0.88-0.94, which means a
 * "who's the better shooter" pass would largely re-collect the overall pass.
 * Rebounding (0.43 average correlation) and defense (0.57) are the independent
 * ones, and `throwing` is a special case: it is not correlated with anything
 * because it contains no information at all yet.
 *
 * Send one axis at a time. Asking for two passes up front is how you get
 * neither.
 */
export type CompareAxis = {
  key: string;
  /**
   * The page's headline. Written per axis rather than derived from the label,
   * because deriving it produces things like "Who's better: throwing?".
   */
  heading: string;
  /** Exactly what the rater is asked, in their words. */
  question: string;
  /** How the axis is named in scripts and links. */
  label: string;
  /**
   * Whether this axis is part of the current collection round.
   *
   * The unified link walks every axis with this set, in order. It is a
   * campaign flag rather than a property of the axis: an axis that has been
   * collected goes back to false rather than being deleted, so its rows keep
   * their meaning and it can be re-opened later.
   */
  collect?: boolean;
  /**
   * The attribute a fit on this axis estimates.
   *
   * Omitted for "overall", which is a weighted mean rather than a stored
   * number, so a fit on it proposes `profiles.overall`. Named for every other
   * axis, which tells `fit-bt.mts` two things it cannot otherwise know: which
   * rating to use as the shrinkage prior, and which one a proposal applies to.
   */
  attribute?: string;
};

export type Position = {
  key: string;
  label: string;
  /** Longer label used in roster cards. */
  full: string;
};

export type SportConfig = {
  id: SportId;
  label: string;
  emoji: string;
  /** Default number of teams when generating. */
  defaultTeams: number;
  /** Typical players per side, used only for hints in the UI. */
  sideSize: number;
  attributes: Attribute[];
  positions: Position[];
  /**
   * A position each team needs at least one of. Balancing already spreads
   * positions evenly, but this lets the UI warn when the group is short.
   */
  criticalPosition?: string;
  /**
   * The attribute where a team's *best* matters more than its average.
   *
   * Averages are the right measure for most things: five players share the
   * rebounding. Throwing isn't shared — one person throws, the team picks who,
   * and they pick their best. Two teams can average identically on it and
   * still be a mismatch if one holds the only arm. Named here, the balancer
   * keeps the best on each side comparable.
   */
  decisiveAttribute?: string;
  /** Configured but not yet built out; hidden from navigation. */
  comingSoon?: boolean;
  /** What the playing surface is called — 'court', 'field'. */
  surface: string;
  /**
   * Questions `/compare/[sport]` can collect, first one the default.
   *
   * Every sport opens with "overall" because that is the number the balancer
   * actually uses, and so the number worth de-biasing first.
   */
  axes: CompareAxis[];
  /**
   * Where each lineup spot sits on the playing surface, as percentages.
   *
   * `position` is the roster position that claims the spot, for sports where
   * several spots take the same one — three receivers line up in different
   * places but they are all WR. It defaults to the spot's own key, which is
   * why basketball never states it.
   */
  spots: {
    key: string;
    label: string;
    full: string;
    x: number;
    y: number;
    position?: string;
    /**
     * Fill this spot with whoever on the team rates highest in this attribute,
     * rather than with whoever holds a position. A role the team elects into
     * each possession isn't a position anyone *is*, so nobody is labelled for
     * it — the lineup just asks who throws best and puts them there.
     */
    byAttribute?: string;
  }[];
  /**
   * Spots ordered by the physical presence they call for, biggest first. Used
   * only to place players who didn't get their own position.
   */
  sizeOrder: string[];
  accent: string;
};

export const SPORTS: Record<SportId, SportConfig> = {
  basketball: {
    id: "basketball",
    label: "Basketball",
    emoji: "🏀",
    defaultTeams: 2,
    sideSize: 5,
    accent: "#e01e37",
    surface: "court",
    axes: [
      {
        key: "overall",
        label: "Overall",
        heading: "Who's better?",
        question: "Pick who you'd rather have on your team.",
      },
      // Defense, and not shooting, because of what correlates with what.
      // Shooting, finishing and playmaking sit at 0.88-0.94 with each other and
      // carry ~48% of the weight: they are "can he play offence" measured three
      // times, so a shooting pass would largely re-collect the overall pass
      // already done. Defense is the most independent attribute after
      // rebounding (0.43 average correlation), which makes it the one axis that
      // can actually disagree with the overall.
      //
      // It is also the attribute most likely to be wrong. The stored ratings
      // note Bang's floored 65 as a known soft spot, and one-way players are
      // exactly where a single rater's read is hardest to check.
      // The three axes of the current round. `collect: true` is what the
      // unified link walks; "overall" is deliberately absent from it, because
      // that pass is settled (§0) and re-asking it would spend the budget on a
      // number nobody is going to change.
      {
        key: "stamina",
        label: "Stamina",
        attribute: "stamina",
        collect: true,
        heading: "Who's still going?",
        question:
          "Pick who you'd rather have in the last game of the night.",
      },
      {
        key: "strength",
        label: "Strength",
        attribute: "strength",
        collect: true,
        heading: "Who's stronger?",
        question:
          "Pick who you'd rather have holding position and boxing out.",
      },
      {
        key: "interior_d",
        label: "Interior D",
        attribute: "interior_d",
        collect: true,
        heading: "Who protects the rim?",
        question: "Pick who you'd rather have guarding the paint.",
      },
    ],
    /*
     * Nine attributes, from an original six.
     *
     * Athleticism split into speed/strength/stamina and defense into
     * perimeter/interior, because badges need attributes to hang on and six
     * numbers cannot carry a large badge list (context.md §6c). Shooting,
     * finishing and playmaking were deliberately NOT split: they correlate at
     * 0.88-0.94, so splitting them mostly produces more correlated things.
     * Rebounding was not split either — at 0.43 it is already the most
     * independent number in the set.
     *
     * WEIGHTS ARE THE PARENT'S, DIVIDED EVENLY. Athleticism's 1.25 becomes
     * three attributes of 1.25/3; defense's 1.10 becomes two of 0.55. That is
     * what makes the split arithmetically neutral: seed each child at its
     * parent's value and every overall is unchanged to the point, because a
     * weighted mean over N copies of V with weight w/N contributes exactly
     * what one copy at weight w did.
     *
     * This is also the answer to the objection that splitting punishes lopsided
     * players (§2c): that only happens when each child inherits the *parent's
     * full* weight, which multiplies the category's influence by N.
     */
    attributes: [
      // Weighted for full-court games to 11: you run the whole floor, boards
      // start breaks, and the man who can still go at 9-9 decides it.
      //
      // The athleticism family. 1.25 was the heaviest weight in the sport and
      // stamina is what it was really about — "the man still going at 9-9".
      {
        key: "speed",
        label: "Speed",
        hint: "First step, end-to-end burst, beating people down the floor",
        weight: 1.25 / 3,
        group: "Physicals",
      },
      {
        key: "strength",
        label: "Strength",
        hint: "Holding position, boxing out, finishing through contact",
        weight: 1.25 / 3,
        group: "Physicals",
      },
      {
        key: "stamina",
        label: "Stamina",
        hint: "Still going at 9-9, game after game",
        weight: 1.25 / 3,
        group: "Physicals",
      },
      {
        key: "finishing",
        label: "Finishing",
        hint: "Layups, contact, scoring inside and in transition",
        weight: 1.15,
        group: "Finishing",
      },
      {
        key: "rebounding",
        label: "Rebounding",
        hint: "Boxing out, second chances, starting the break",
        weight: 1.15,
        group: "Rebounding",
      },
      // The defense family. Guarding Eric and guarding Jason are not the same
      // job, and the stored height already informs which one someone does.
      {
        key: "perimeter_d",
        label: "Perimeter D",
        hint: "Staying in front on the ball, fighting over screens",
        weight: 1.1 / 2,
        group: "Defense",
      },
      {
        key: "interior_d",
        label: "Interior D",
        hint: "Protecting the rim, help defense, guarding size",
        weight: 1.1 / 2,
        group: "Defense",
      },
      {
        key: "shooting",
        label: "Shooting",
        hint: "Catch-and-shoot, range, free throws",
        weight: 1.05,
        group: "Shooting",
      },
      {
        key: "playmaking",
        label: "Playmaking",
        hint: "Handles, passing, pushing it in transition",
        weight: 1.0,
        group: "Playmaking",
      },
    ],
    positions: [
      { key: "pg", label: "PG", full: "Point Guard" },
      { key: "sg", label: "SG", full: "Shooting Guard" },
      { key: "sf", label: "SF", full: "Small Forward" },
      { key: "pf", label: "PF", full: "Power Forward" },
      { key: "c", label: "C", full: "Center" },
    ],
    spots: [
      { key: "c", label: "C", full: "Center", x: 30, y: 17 },
      { key: "pf", label: "PF", full: "Power Forward", x: 70, y: 17 },
      { key: "sf", label: "SF", full: "Small Forward", x: 23, y: 53 },
      { key: "sg", label: "SG", full: "Shooting Guard", x: 77, y: 53 },
      { key: "pg", label: "PG", full: "Point Guard", x: 50, y: 80 },
    ],
    sizeOrder: ["c", "pf", "sf", "sg", "pg"],
  },
  football: {
    id: "football",
    label: "Football",
    emoji: "\u{1F3C8}",
    defaultTeams: 2,
    sideSize: 5,
    accent: "#16a34a",
    surface: "field",
    axes: [
      {
        key: "overall",
        label: "Overall",
        heading: "Who's better?",
        question: "Pick who you'd rather have on your team.",
      },
      // No throwing axis, deliberately.
      //
      // `throwing` is still the emptiest number in the app — flat 75 for all
      // twelve, and load bearing, since it picks the quarterback and the
      // balancer scores it on each side's best. On the merits it is the most
      // collectable thing here.
      //
      // It is not collected because football is parked. Every send spends the
      // same scarce thing — a friend's willingness to answer sixty questions —
      // and that is being spent on basketball until basketball is finished.
      // Football has also never had its own overall pass, so a throwing pass
      // would have been the second question asked of a sport nobody has
      // answered a first one about.
    ],
    // Nobody is designated. A side can ride whoever has the hot hand, and does.
    decisiveAttribute: "throwing",
    attributes: [
      {
        key: "hands",
        label: "Hands",
        hint: "Catching in traffic, contested grabs, drops",
        weight: 1.15,
      },
      {
        key: "speed",
        label: "Speed",
        hint: "Straight-line burst, running past people",
        weight: 1.1,
      },
      {
        key: "coverage",
        label: "Coverage",
        hint: "Man defense, jumping routes, picks",
        weight: 1.1,
      },
      {
        key: "routes",
        label: "Routes",
        hint: "Shiftiness, cuts, getting open short",
        weight: 1.05,
      },
      {
        key: "iq",
        label: "Football IQ",
        hint: "Spacing, reads, scrambling with the QB",
        weight: 0.9,
      },
      // Only one player throws per possession, so a low weight here keeps a
      // pocket-passer from being over-rated as an all-around player. Teams get
      // a thrower via the QB position spread instead.
      {
        key: "throwing",
        label: "Throwing",
        hint: "Arm strength and accuracy \u2014 QBs only",
        weight: 0.7,
      },
    ],
    // Quarterback is deliberately absent. This group plays it as a role the
    // team elects into and switches at will — riding a hot hand — so making it
    // a position would designate what nobody designates, and would have the
    // balancer solving for a scarcity that isn't real. What remains is where
    // people line up.
    positions: [
      { key: "te", label: "TE", full: "Tight End" },
      { key: "wr", label: "WR", full: "Receiver" },
      { key: "slot", label: "SLOT", full: "Slot" },
    ],
    // Four receivers and a quarterback. The QB spot names no position: it goes
    // to whoever on the side throws best, which is how the side would pick.
    spots: [
      { key: "wr_l", label: "WR", full: "Wide left", x: 30, y: 17, position: "wr" },
      { key: "wr_r", label: "WR", full: "Wide right", x: 70, y: 17, position: "wr" },
      { key: "te", label: "TE", full: "Tight end", x: 23, y: 53 },
      { key: "slot", label: "SLOT", full: "Slot", x: 77, y: 53 },
      { key: "qb", label: "QB", full: "Quarterback", x: 50, y: 80, byAttribute: "throwing" },
    ],
    sizeOrder: ["te", "wr_l", "wr_r", "slot"],
  },
};

export const SPORT_IDS = Object.keys(SPORTS) as SportId[];

export function isSportId(value: string): value is SportId {
  return value === "basketball" || value === "football";
}

/**
 * Every CSS variable a sport's chrome is built from, derived from its one
 * declared accent. Shared by the sport page and the share page so a link out of
 * basketball still looks like basketball.
 *
 * The accent is only a hint in the surfaces: tinting panels heavily leaves them
 * at the same value as the ground and nothing reads as a card. Panels step up
 * in brightness instead, and the accent goes where it means something.
 *
 * Returned as plain strings rather than CSSProperties so this module stays
 * free of React types — the rating scripts import it under plain node.
 */
export function sportChrome(sport: SportConfig): Record<string, string> {
  const a = sport.accent;
  const mix = (pct: number, base: string) =>
    `color-mix(in srgb, ${a} ${pct}%, ${base})`;
  return {
    "--accent": a,
    "--accent-strong": mix(72, "white"),
    "--accent-wash": mix(15, "#0e1014"),
    "--accent-line": mix(42, "#0e1014"),
    // The accent as it has to appear on the page's silver ground rather than
    // on a dark card. Full-strength green reads at about 2.6:1 out there, so
    // controls like "Clear" and "Auto-pick" were barely text at all.
    "--accent-ink": mix(72, "#07070a"),
    "--background": mix(7, "#07070a"),
    "--surface": mix(9, "#191920"),
    "--surface-sunken": mix(7, "#101014"),
    "--surface-raised": mix(12, "#24242e"),
    "--border": mix(24, "#33333f"),
    "--border-strong": mix(36, "#4a4a59"),
    "--foreground": mix(4, "#ffffff"),
    "--muted": mix(12, "#adb3c4"),
  };
}

export const RATING_MIN = 65;
export const RATING_MAX = 99;
export const RATING_DEFAULT = 80;

/** Weighted mean of a player's attributes, clamped to the 25-99 rating scale. */
export function computeOverall(
  sport: SportConfig,
  ratings: Record<string, number>,
): number {
  let total = 0;
  let weight = 0;
  for (const attr of sport.attributes) {
    const value = ratings[attr.key] ?? RATING_DEFAULT;
    total += value * attr.weight;
    weight += attr.weight;
  }
  if (weight === 0) return RATING_DEFAULT;
  return Math.round(Math.min(RATING_MAX, Math.max(RATING_MIN, total / weight)));
}

export function defaultRatings(sport: SportConfig): Record<string, number> {
  return Object.fromEntries(
    sport.attributes.map((a) => [a.key, RATING_DEFAULT]),
  );
}

/** 71 -> 5'11". Null when a height hasn't been recorded. */
export function formatHeight(inches: number | null | undefined): string | null {
  if (typeof inches !== "number" || !Number.isFinite(inches)) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}
