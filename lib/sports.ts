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
 * One link per round, not per axis. A send used to be a single question, and
 * the rule then was "send one axis at a time". A round now walks every axis
 * flagged `collect` as sequential blocks behind one link, because three links
 * asked in order is how a round gets half-finished (context.md 6h).
 */
export type CompareAxis = {
  key: string;
  /**
   * The page's headline. Written per axis rather than derived from the label,
   * because deriving it produces things like "Who's better: throwing?".
   *
   * **Name the attribute here.** This is the one line that reliably gets read,
   * and a flavour headline like "Who's still going?" leaves the actual question
   * in a paragraph nobody scans.
   */
  heading: string;
  /** Exactly what the rater is asked, in their words. */
  question: string;
  /**
   * The question restated immediately above the two names.
   *
   * The headline is at the top of the page; the decision happens 300px lower,
   * and after the first few answers a rater is only looking at the buttons.
   * This sits at the point of the decision, and it is what stops someone
   * answering the strength block as though it were still the stamina one.
   */
  prompt: string;
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
   * How this axis is collected.
   *
   * `comparative` (the default) is the pairwise question the collector was
   * built for: two names, one winner, fitted by Bradley-Terry into a full
   * 65-99 ordering. It costs ~30 questions because a stable fit needs each
   * player to appear ~21 times.
   *
   * `tick` is one pass over the whole roster - "tick everyone who actually
   * posts up" - answered in about twenty seconds. It yields membership, not a
   * ranking, and it is the right shape when most of the roster genuinely does
   * not do the thing. See context.md 6j for the sparsity rule that decides
   * which an attribute gets.
   *
   * `comp` is one pass over the whole roster too, but the answer is a NAME
   * rather than a checkbox: "who does he play like?" picked from a curated NBA
   * list. It is a label, never a number, and nothing fitted from it reaches the
   * ratings. It is cheap where a per-axis pairwise verdict is not, because a
   * comp is one question per player rather than per pair - see context.md 6o.
   *
   * Neither `tick` nor `comp` enters `blockTargets`: their cost is one pass,
   * not a share of SESSION_TARGET.
   */
  mode?: "comparative" | "tick" | "comp";
  /**
   * How many questions this block asks, overriding the shared session budget.
   *
   * `SESSION_TARGET` divided by the number of comparative axes was fine while
   * a round was three blocks. It stops working the moment a round can grow:
   * adding two axes silently drops every block from 27 questions to 16, which
   * both thins the new data and rewrites what "complete" meant for people who
   * already finished. Naming the depth per axis makes a round extensible —
   * existing blocks keep the target they were answered against, and a new
   * attribute asks for what it actually needs.
   *
   * ~25-30 is the working range: at six raters and seventeen players a block
   * of 25 gives each player ~17.6 appearances, comfortably above the <8 the
   * fit flags as thin.
   */
  target?: number;
  /**
   * Restrict this block to a named slate of players.
   *
   * Frozen from a tick pass rather than computed per rater. One person ran the
   * four tick passes and identified who actually does each thing, which makes
   * every rater rank **the same** people — dense pair coverage, every pair
   * judged by everybody, which is what Bradley-Terry wants. Per-rater pools
   * would have splintered into slightly different slates and thinned the
   * overlap.
   *
   * A one-person tick is a single-rater input, which is normally the thing
   * `/compare` exists to remove. The exposure is small because a tick is a
   * FACT, not a rating - the same class of input as `height_inches`. All of
   * the ranking, which is where the bias actually lived, still comes from the
   * group.
   *
   * Names, not ids, so the slate is readable and reviewable in this file.
   * Resolved against the roster server-side; a name that matches nobody is
   * dropped rather than throwing, because a roster change should not 500 the
   * collector.
   */
  poolNames?: string[];
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
        heading: "Who's the better player?",
        prompt: "Which one is the better player?",
        question: "Pick who you'd rather have on your team.",
      },
      /*
       * TICK PASSES — collected 2026-08-29, by one person, and now CLOSED.
       *
       * Kept in the config rather than deleted: `collect: false` is how an
       * axis retires, so its rows keep their meaning and it can be reopened if
       * the roster changes. The slates they produced are frozen into the
       * `poolNames` of the ranking blocks below.
       *
       * What they bought, beyond the slates: `three_point` came back ticked
       * for 15 of 16, which is the sparsity rule (context.md 6j) rejecting it
       * as a pool attribute. It is a full-roster comparative below instead of
       * a 105-pair round-robin. Catching that cost one twenty-second pass.
       */
      {
        key: "post_control",
        label: "Post Control (tick)",
        attribute: "post_control",
        mode: "tick",
        heading: "Who actually posts up?",
        prompt: "Tick everyone who posts up.",
        question:
          "Tick everyone who works from the block - turnarounds, fades, backing people down. Leave the rest.",
      },
      {
        key: "block",
        label: "Block (tick)",
        attribute: "block",
        mode: "tick",
        heading: "Who blocks shots?",
        prompt: "Tick everyone who blocks shots.",
        question:
          "Tick everyone who genuinely blocks shots at the rim - not just contests them.",
      },
      {
        key: "steal",
        label: "Steal (tick)",
        attribute: "steal",
        mode: "tick",
        heading: "Who gets steals?",
        prompt: "Tick everyone who gets steals.",
        question:
          "Tick everyone who picks off passes and digs the ball out of people's hands.",
      },
      {
        key: "three_point",
        label: "Three Point (tick)",
        attribute: "three_point",
        mode: "tick",
        heading: "Who shoots threes?",
        prompt: "Tick everyone who shoots threes.",
        question:
          "Tick everyone who can genuinely hit a three in a game - not in warmups.",
      },

      /*
       * THE ROUND — nine comparative blocks behind one link.
       *
       * Ordered so that an abandoned tail costs the least. The pool rankings
       * come first: they are the shortest blocks and carry the most novel
       * information, because nothing in the app measures them yet. The three
       * in-flight axes follow (two raters have already finished them, so they
       * cost those two nothing). Ball handle and offensive rebound go last, as
       * the two most redundant with what is already collected.
       *
       * Every block names its own `target`. Sharing SESSION_TARGET stopped
       * working once the round could grow — adding two axes to a three-axis
       * round silently drops every block from 27 questions to 16.
       */
      {
        key: "post_control_rank",
        label: "Post Control",
        attribute: "post_control",
        collect: true,
        target: 15,
        poolNames: [
          "Alfonso",
          "Bang",
          "Brendan",
          "Jason",
          "Kylan",
          "Lucas",
          "Orion",
          "Sean",
          "Victor",
        ],
        heading: "Who's better in the post?",
        prompt: "Which one is better in the post?",
        question:
          "Both of these work from the block. Pick who you'd rather have backing someone down.",
      },
      {
        key: "block_rank",
        label: "Shot Blocking",
        attribute: "block",
        collect: true,
        target: 6,
        poolNames: ["Jason", "Joe", "Kylan", "Taha"],
        heading: "Who's the better shot blocker?",
        prompt: "Which one is the better shot blocker?",
        question:
          "Both of these block shots. Pick who you'd rather have protecting the rim.",
      },
      {
        key: "steal_rank",
        label: "Steals",
        attribute: "steal",
        collect: true,
        target: 15,
        poolNames: [
          "Bang",
          "Brendan",
          "Brian",
          "David",
          "Eric",
          "Kylan",
          "Orion",
          "Taha",
          "Victor",
        ],
        heading: "Who gets more steals?",
        prompt: "Which one gets more steals?",
        question:
          "Both of these pick off passes. Pick who takes the ball away more often.",
      },
      {
        key: "three_point_rank",
        label: "Three Point",
        attribute: "three_point",
        collect: true,
        target: 25,
        // Fifteen of sixteen were ticked, so this is not a pool - it is very
        // nearly the roster. The two who were not ticked are left out rather
        // than asked about, which is the only work the tick did here.
        poolNames: [
          "Alfonso",
          "Bang",
          "Brendan",
          "Brian",
          "Danny",
          "David",
          "Eric",
          "Jason",
          "Joe",
          "Justin",
          "Lucas",
          "Orion",
          "Rayan",
          "Taha",
          "Victor",
        ],
        heading: "Who's the better three-point shooter?",
        prompt: "Which one is the better three-point shooter?",
        question: "Both of these shoot threes. Pick who you'd rather have taking one.",
      },

      // The three in-flight axes. Their targets are stated explicitly at the
      // values they were already answered against - 27/27/26 - so that the two
      // raters who finished them stay finished.
      {
        key: "stamina",
        label: "Stamina",
        attribute: "stamina",
        collect: true,
        target: 27,
        heading: "Who has better stamina?",
        prompt: "Which one has better stamina?",
        question:
          "Pick who you'd rather have in the last game of the night — still going at 9-9.",
      },
      {
        key: "strength",
        label: "Strength",
        attribute: "strength",
        collect: true,
        target: 27,
        heading: "Who is stronger?",
        prompt: "Which one is stronger?",
        question:
          "Pick who you'd rather have holding position and boxing out.",
      },
      {
        key: "interior_d",
        label: "Interior D",
        attribute: "interior_d",
        collect: true,
        target: 26,
        heading: "Who's the better interior defender?",
        prompt: "Which one is the better interior defender?",
        question:
          "Pick who you'd rather have guarding the paint and protecting the rim.",
      },

      // Last, because they are the most redundant with what is already
      // collected. Offensive rebounding is the stronger of the two:
      // rebounding is the most independent number in the set (0.43), while
      // ball handle sits inside the 0.88-0.94 offensive blob.
      {
        key: "off_reb",
        label: "Offensive Reb",
        attribute: "off_reb",
        collect: true,
        target: 25,
        heading: "Who's the better offensive rebounder?",
        prompt: "Which one is the better offensive rebounder?",
        question:
          "Pick who you'd rather have crashing the glass for a second chance.",
      },
      {
        key: "ball_handle",
        label: "Ball Handle",
        attribute: "ball_handle",
        collect: true,
        target: 25,
        heading: "Who's the better ball handler?",
        prompt: "Which one is the better ball handler?",
        question:
          "Pick who you'd rather have bringing it up against pressure.",
      },
      /*
       * The comp block. Deliberately last in the round: it is the shortest and
       * the most fun, so it is what a rater arrives at after the grind rather
       * than the thing that distracts from it.
       *
       * No `attribute`, because nothing is fitted from this. A comp is a label
       * the group applies to a player, and `fit-bt.mts` must never see it.
       */
      {
        key: "nba_comp",
        heading: "Which NBA player do they play like?",
        question: "Pick the NBA player each of these reminds you of.",
        prompt: "Which NBA player does he play like?",
        label: "NBA Comp",
        collect: true,
        mode: "comp",
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
      // The Physicals family. 1.25 was the heaviest weight in the sport and
      // stamina is what it was really about - "the man still going at 9-9".
      // Acceleration and vertical were proposed and cut: acceleration is the
      // "Driving Dunk vs Standing Dunk" case (nobody here holds a considered
      // view separating it from speed), and vertical dies the same death
      // dunking did, on a group that does not play above the rim.
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
        hint: "Holding position in the post, absorbing contact, not getting moved",
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
      // The Finishing family. In a group with nobody finishing above the rim,
      // the two ways anyone scores inside are attacking the rim and working
      // from the block, and those come apart on real people. "Close shot" was
      // proposed as a third and cut: it was measuring the driving layup twice.
      {
        key: "driving_layup",
        label: "Driving Layup",
        hint: "Attacking the rim off the dribble, finishing in traffic",
        weight: 1.15 / 2,
        group: "Finishing",
      },
      {
        key: "post_control",
        label: "Post Control",
        hint: "Working from the block - turnarounds, fades, backing down",
        weight: 1.15 / 2,
        group: "Finishing",
      },
      // The Rebounding family. Rebounding was the most independent number in
      // the six (0.43 average correlation), which is why it was left whole in
      // the first split. It is split now for badges, and kept as its OWN
      // family rather than folded in with Defense - averaging offensive and
      // defensive boards into a six-child defensive blob would dilute the one
      // number that carries its own information.
      {
        key: "def_reb",
        label: "Defensive Reb",
        hint: "Boxing out, clearing the defensive glass, starting the break",
        weight: 1.15 / 2,
        group: "Rebounding",
      },
      {
        key: "off_reb",
        label: "Offensive Reb",
        hint: "Crashing the offensive glass, second chances, tip-ins",
        weight: 1.15 / 2,
        group: "Rebounding",
      },
      // The Defense family. Guarding Eric and guarding Jason are not the same
      // job, and the stored height already informs which one someone does.
      // Steal and block join as the two defensive events a pickup group
      // actually notices happening.
      {
        key: "perimeter_d",
        label: "Perimeter D",
        hint: "Staying in front on the ball, fighting over screens",
        weight: 1.1 / 4,
        group: "Defense",
      },
      {
        key: "interior_d",
        label: "Interior D",
        hint: "Protecting the rim, help defense, guarding size",
        weight: 1.1 / 4,
        group: "Defense",
      },
      {
        key: "steal",
        label: "Steal",
        hint: "Reading passing lanes, digging at the ball, forcing turnovers",
        weight: 1.1 / 4,
        group: "Defense",
      },
      {
        key: "block",
        label: "Block",
        hint: "Contesting at the rim, timing shots, erasing layups",
        weight: 1.1 / 4,
        group: "Defense",
      },
      // The Shooting family. These two sit inside the 0.88-0.94 offensive
      // blob and splitting them was expected to produce two correlated
      // numbers rather than two independent ones; the split is here for the
      // badge list, not because it buys information.
      {
        key: "mid_range",
        label: "Mid Range",
        hint: "Pull-ups and spot shots from inside the arc",
        weight: 1.05 / 2,
        group: "Shooting",
      },
      {
        key: "three_point",
        label: "Three Point",
        hint: "Range out to the line, catch-and-shoot from deep",
        weight: 1.05 / 2,
        group: "Shooting",
      },
      // The Playmaking family. "Speed with ball" was proposed as a third and
      // cut by the sparsity rule: everybody dribbles, so a tick pass on it
      // returns seventeen ticks and no information.
      {
        key: "pass_accuracy",
        label: "Pass Accuracy",
        hint: "Finding the open man, hitting the right read on time",
        weight: 1.0 / 2,
        group: "Playmaking",
      },
      {
        key: "ball_handle",
        label: "Ball Handle",
        hint: "Handling pressure, creating off the dribble, protecting it",
        weight: 1.0 / 2,
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
        heading: "Who's the better player?",
        prompt: "Which one is the better player?",
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
      {
        key: "wr_l",
        label: "WR",
        full: "Wide left",
        x: 30,
        y: 17,
        position: "wr",
      },
      {
        key: "wr_r",
        label: "WR",
        full: "Wide right",
        x: 70,
        y: 17,
        position: "wr",
      },
      { key: "te", label: "TE", full: "Tight end", x: 23, y: 53 },
      { key: "slot", label: "SLOT", full: "Slot", x: 77, y: 53 },
      {
        key: "qb",
        label: "QB",
        full: "Quarterback",
        x: 50,
        y: 80,
        byAttribute: "throwing",
      },
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
