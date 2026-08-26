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
  accent: string;
};

export const SPORTS: Record<SportId, SportConfig> = {
  basketball: {
    id: "basketball",
    label: "Basketball",
    emoji: "🏀",
    defaultTeams: 2,
    sideSize: 5,
    accent: "#4f46e5",
    attributes: [
      {
        key: "shooting",
        label: "Shooting",
        hint: "Catch-and-shoot, range, free throws",
        weight: 1.15,
      },
      {
        key: "finishing",
        label: "Finishing",
        hint: "Layups, contact, scoring inside",
        weight: 1.1,
      },
      {
        key: "playmaking",
        label: "Playmaking",
        hint: "Handles, passing, decisions",
        weight: 1.05,
      },
      {
        key: "defense",
        label: "Defense",
        hint: "On-ball pressure, help, steals",
        weight: 1.1,
      },
      {
        key: "rebounding",
        label: "Rebounding",
        hint: "Boxing out, second chances",
        weight: 0.85,
      },
      {
        key: "athleticism",
        label: "Athleticism",
        hint: "Speed, hops, motor, conditioning",
        weight: 0.95,
      },
    ],
    positions: [
      { key: "guard", label: "G", full: "Guard" },
      { key: "wing", label: "W", full: "Wing" },
      { key: "big", label: "B", full: "Big" },
    ],
  },
  football: {
    id: "football",
    label: "Football",
    emoji: "\u{1F3C8}",
    defaultTeams: 2,
    sideSize: 5,
    accent: "#0d9488",
    criticalPosition: "qb",
    comingSoon: true,
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
    positions: [
      { key: "qb", label: "QB", full: "Quarterback" },
      { key: "receiver", label: "WR", full: "Receiver" },
      { key: "rusher", label: "RSH", full: "Rusher" },
    ],
  },
};

export const SPORT_IDS = Object.keys(SPORTS) as SportId[];

export function isSportId(value: string): value is SportId {
  return value === "basketball" || value === "football";
}

export const RATING_MIN = 25;
export const RATING_MAX = 99;
export const RATING_DEFAULT = 70;

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
