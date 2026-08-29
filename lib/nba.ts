/**
 * The NBA players a comp can be picked from.
 *
 * **Curated rather than free text, and that is the whole design.** With five
 * raters answering freely about seventeen people you get five different names
 * per player and no modal answer at all — the feature would collect a pile of
 * singletons and never be able to say "the group thinks he plays like X". A
 * fixed list concentrates the votes so a mode can exist. Free text stays
 * available as an escape hatch, and those answers are stored verbatim.
 *
 * Grouped by how someone plays, not by position, because that is how the
 * question is actually answered — "he's a stretch big" comes to mind before
 * "he's a power forward". The groups are also what make fifty names scannable
 * on a phone.
 *
 * Chosen for recognisability over completeness: a comp nobody in the group can
 * picture is a comp nobody will pick. Era-mixed on purpose for the same reason.
 *
 * This list shapes the answers, so it is meant to be edited. Adding a name is
 * safe — comps are stored as text, so nothing breaks and no migration is
 * needed. Removing one leaves existing answers intact and unpickable.
 */
export type CompGroup = { label: string; players: string[] };

export const NBA_COMPS: CompGroup[] = [
  {
    label: "Lead guards",
    players: [
      "Stephen Curry",
      "Damian Lillard",
      "Kyrie Irving",
      "Luka Dončić",
      "Shai Gilgeous-Alexander",
      "Ja Morant",
      "Trae Young",
      "Chris Paul",
      "Tyrese Haliburton",
      "Allen Iverson",
      "Steve Nash",
      "Rajon Rondo",
    ],
  },
  {
    label: "Scoring wings",
    players: [
      "Michael Jordan",
      "Kobe Bryant",
      "Kevin Durant",
      "James Harden",
      "Jayson Tatum",
      "Devin Booker",
      "Anthony Edwards",
      "Paul George",
      "Jaylen Brown",
      "Klay Thompson",
    ],
  },
  {
    label: "Two-way forwards",
    players: [
      "LeBron James",
      "Kawhi Leonard",
      "Jimmy Butler",
      "Scottie Pippen",
      "Mikal Bridges",
      "OG Anunoby",
      "Andrei Kirilenko",
    ],
  },
  {
    label: "Athletes and slashers",
    players: [
      "Giannis Antetokounmpo",
      "Zion Williamson",
      "Russell Westbrook",
      "Aaron Gordon",
      "Vince Carter",
      "Derrick Rose",
    ],
  },
  {
    label: "Bigs",
    players: [
      "Nikola Jokić",
      "Joel Embiid",
      "Shaquille O'Neal",
      "Tim Duncan",
      "Hakeem Olajuwon",
      "Anthony Davis",
      "Domantas Sabonis",
      "Bam Adebayo",
      "Rudy Gobert",
      "Charles Barkley",
    ],
  },
  {
    label: "Shooters",
    players: [
      "Ray Allen",
      "Reggie Miller",
      "Duncan Robinson",
      "Buddy Hield",
      "Kyle Korver",
      "JJ Redick",
    ],
  },
  {
    label: "Defenders and pests",
    players: [
      "Draymond Green",
      "Marcus Smart",
      "Jrue Holiday",
      "Dennis Rodman",
      "Alex Caruso",
      "Luguentz Dort",
    ],
  },
  {
    label: "Glue guys and bench scorers",
    players: [
      "PJ Tucker",
      "Kevon Looney",
      "Lou Williams",
      "Jamal Crawford",
      "Montrezl Harrell",
      "Patrick Beverley",
    ],
  },
];

/** Every listed name, flat. */
export const NBA_COMP_NAMES: string[] = NBA_COMPS.flatMap((g) => g.players);

/**
 * Tidy a submitted comp without judging it.
 *
 * Free-text answers are kept verbatim apart from whitespace and length, because
 * normalising "mini LeBron" into "LeBron James" would erase the distinction the
 * rater was drawing. An empty string means "no comp in mind" and is stored as
 * null, which is a real answer.
 */
export function normalizeComp(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim().replace(/\s+/g, " ").slice(0, 60);
  return text === "" ? null : text;
}
