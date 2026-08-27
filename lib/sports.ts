export type SportId = "basketball" | "football";

export type Attribute = {
  key: string;
  label: string;
  /** Short hint shown under the slider when editing. */
  hint: string;
  /** Relative contribution to the overall rating. */
  weight: number;
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
  /** Configured but not yet built out; hidden from navigation. */
  comingSoon?: boolean;
  /** What the playing surface is called — 'court', 'field'. */
  surface: string;
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
    attributes: [
      // Weighted for full-court games to 11: you run the whole floor, boards
      // start breaks, and the man who can still go at 9-9 decides it.
      {
        key: "athleticism",
        label: "Athleticism",
        hint: "Speed, hops, and conditioning — you run all game",
        weight: 1.25,
      },
      {
        key: "finishing",
        label: "Finishing",
        hint: "Layups, contact, scoring inside and in transition",
        weight: 1.15,
      },
      {
        key: "rebounding",
        label: "Rebounding",
        hint: "Boxing out, second chances, starting the break",
        weight: 1.15,
      },
      {
        key: "defense",
        label: "Defense",
        hint: "On-ball pressure, help, getting back",
        weight: 1.1,
      },
      {
        key: "shooting",
        label: "Shooting",
        hint: "Catch-and-shoot, range, free throws",
        weight: 1.05,
      },
      {
        key: "playmaking",
        label: "Playmaking",
        hint: "Handles, passing, pushing it in transition",
        weight: 1.0,
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
    criticalPosition: "qb",
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
    // There is no run game and no designated rusher. The slot is the closest
    // thing to a back — short routes run as if he came out of the backfield —
    // which makes it a role of its own rather than a third receiver.
    positions: [
      { key: "qb", label: "QB", full: "Quarterback" },
      { key: "te", label: "TE", full: "Tight End" },
      { key: "wr", label: "WR", full: "Receiver" },
      { key: "slot", label: "SLOT", full: "Slot" },
    ],
    // Four receivers and a quarterback — there's no line to draw. The two
    // outside spots share the WR position, so each names it.
    spots: [
      { key: "wr_l", label: "WR", full: "Wide left", x: 30, y: 17, position: "wr" },
      { key: "wr_r", label: "WR", full: "Wide right", x: 70, y: 17, position: "wr" },
      { key: "te", label: "TE", full: "Tight end", x: 23, y: 53 },
      { key: "slot", label: "SLOT", full: "Slot", x: 77, y: 53 },
      { key: "qb", label: "QB", full: "Quarterback", x: 50, y: 80 },
    ],
    sizeOrder: ["te", "wr_l", "wr_r", "slot", "qb"],
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
    "--background": mix(7, "#07070a"),
    "--surface": mix(9, "#191920"),
    "--surface-sunken": mix(7, "#101014"),
    "--surface-raised": mix(12, "#24242e"),
    "--border": mix(24, "#33333f"),
    "--border-strong": mix(36, "#4a4a59"),
    "--foreground": mix(4, "#ffffff"),
    "--muted": mix(12, "#adb3c4"),
    // Contained to the top, like a light over the near end of the court,
    // rather than a wash across the page. Below the fold it is simply dark.
    "--page-background": [
      `linear-gradient(180deg, ${mix(62, "transparent")} 0%, ${mix(24, "transparent")} 18%, transparent 46%)`,
      `radial-gradient(70rem 26rem at 78% -6rem, ${mix(34, "transparent")}, transparent)`,
      mix(7, "#07070a"),
    ].join(", "),
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
