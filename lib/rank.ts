/**
 * Standings that do not claim more than the ratings support.
 *
 * The roster list numbered every row `i + 1`, and the sort broke a tie
 * alphabetically. Two players stored at the same overall therefore printed as
 * 7th and 8th because one name starts with J and the other with L - an order
 * the sheet never computed, presented in the one place a reader takes an order
 * literally. It is the same lie `BadgeIcon` was written to avoid when it
 * refused to paint an untiered badge gold.
 *
 * The rule: **players showing the same overall share a rank.** Not a
 * closeness threshold - the app publishes an integer, so two people showing 79
 * and 78 already read as different and the rank adds nothing to that. Two
 * people both showing 79 read as equal *until* the ordinal contradicts them,
 * which is exactly the unsupported claim. Rounding to the same number is the
 * app's own statement that it cannot tell them apart, and this makes the rank
 * agree with it.
 *
 * Standard competition ranking ("1224"): a tied group takes the best rank it
 * could hold, and the next distinct value skips the ranks the tie consumed, so
 * the last rank still equals the roster size.
 */

export type Ranked = {
  /** 1-based, shared by everyone holding the same value. */
  rank: number;
  /** Whether at least one other entry holds this value. */
  tied: boolean;
};

/**
 * `values` must already be in display order, best first. Rank comes from
 * position, so an unsorted array produces a meaningless ranking rather than a
 * sorted one - this deliberately does not sort for you, because the caller's
 * sort is what the reader actually sees.
 */
export function competitionRanks(values: number[]): Ranked[] {
  return values.map((value) => {
    // The first index holding this value sets the rank for the whole group.
    const first = values.indexOf(value);
    return {
      rank: first + 1,
      tied: values.lastIndexOf(value) !== first,
    };
  });
}

/**
 * "7" or "T7". The T is the leaderboard convention and survives being read at
 * a glance in a six-character column, which "=7" and "7=" do not.
 */
export function rankLabel(ranked: Ranked): string {
  return ranked.tied ? `T${ranked.rank}` : `${ranked.rank}`;
}
