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
  accent: string;
};

export const SPORTS: Record<SportId, SportConfig> = {
  basketball: {
    id: "basketball",
    label: "Basketball",
    emoji: "🏀",
    defaultTeams: 2,
    sideSize: 5,
    accent: "#f97316",
    attributes: [
      { key: "shooting", label: "Shooting", hint: "Catch-and-shoot, range, free throws", weight: 1.15 },
      { key: "finishing", label: "Finishing", hint: "Layups, contact, scoring inside", weight: 1.1 },
      { key: "playmaking", label: "Playmaking", hint: "Handles, passing, decisions", weight: 1.05 },
      { key: "defense", label: "Defense", hint: "On-ball pressure, help, steals", weight: 1.1 },
      { key: "rebounding", label: "Rebounding", hint: "Boxing out, second chances", weight: 0.85 },
      { key: "athleticism", label: "Athleticism", hint: "Speed, hops, motor, conditioning", weight: 0.95 },
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
    emoji: "🏈",
    defaultTeams: 2,
    sideSize: 5,
    accent: "#22c55e",
    attributes: [
      { key: "speed", label: "Speed", hint: "Straight-line burst and separation", weight: 1.1 },
      { key: "hands", label: "Hands", hint: "Catching in traffic, contested grabs", weight: 1.1 },
      { key: "throwing", label: "Throwing", hint: "Arm strength and accuracy", weight: 0.9 },
      { key: "routes", label: "Routes", hint: "Cuts, timing, getting open", weight: 1.0 },
      { key: "coverage", label: "Coverage", hint: "Sticking with a receiver, ball skills", weight: 1.1 },
      { key: "iq", label: "Football IQ", hint: "Reads, spacing, situational awareness", weight: 0.9 },
    ],
    positions: [
      { key: "qb", label: "QB", full: "Quarterback" },
      { key: "skill", label: "SKL", full: "Skill / Receiver" },
      { key: "rusher", label: "RSH", full: "Rusher / Line" },
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
export function computeOverall(sport: SportConfig, ratings: Record<string, number>): number {
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
  return Object.fromEntries(sport.attributes.map((a) => [a.key, RATING_DEFAULT]));
}
