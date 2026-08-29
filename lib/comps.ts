/**
 * Reading the collected NBA comps.
 *
 * Pure and server-safe. A comp is a **label, never a number** — nothing here
 * feeds a rating, an attribute or the overall, and `fit-bt.mts` must never see
 * this data.
 */
export type CompVote = { subjectId: string; comp: string | null };

export type CompVerdict = {
  /** The most-voted comp, or null when nothing clears the bar. */
  comp: string | null;
  /** How many raters said it. */
  votes: number;
  /** How many raters answered about this subject at all, skips included. */
  answers: number;
  /** Everything said about him, most-voted first. */
  all: { comp: string; votes: number }[];
};

/**
 * The group's comp for one player.
 *
 * **Two agreeing is the bar.** One person's answer rendered as "the group" is
 * the failure this app has already had twice, and a single vote is exactly
 * that. Below the bar the verdict is null and the raw list is still returned,
 * so a card can choose to show "Victor says…" with attribution rather than
 * passing it off as a consensus.
 *
 * Skips are counted in `answers` but never win. "Nobody had a comp for him" is
 * a real finding about a player; it is not a comp.
 */
export function verdict(votes: CompVote[], bar = 2): CompVerdict {
  const tally = new Map<string, number>();
  for (const v of votes) {
    if (v.comp === null) continue;
    tally.set(v.comp, (tally.get(v.comp) ?? 0) + 1);
  }
  const all = [...tally.entries()]
    .map(([comp, n]) => ({ comp, votes: n }))
    .sort((a, b) => b.votes - a.votes || a.comp.localeCompare(b.comp));

  const top = all[0];
  const clears = top && top.votes >= bar;
  /*
   * A tie at the top is not a verdict. Two names with two votes each is the
   * group being split, and picking one alphabetically would invent a consensus
   * out of a coin flip.
   */
  const tied = all.length > 1 && all[1].votes === top?.votes;

  return {
    comp: clears && !tied ? top.comp : null,
    votes: clears && !tied ? top.votes : 0,
    answers: votes.length,
    all,
  };
}
