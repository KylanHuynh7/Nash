/**
 * Recorded games — validation and what they say about the ratings.
 *
 * Pure and server-safe, like `lineup.ts` and for the same reason: the rules
 * about what counts as a recordable result belong somewhere a test can reach
 * without a database, and the server action is a public endpoint that has to
 * apply them anyway.
 *
 * **The reason this is worth collecting at all.** The balancer drives team
 * averages to within ~0.1 of each other, so every generated matchup is a
 * near-level one and the ratings predict close to a coin flip. That makes each
 * recorded game a small natural experiment: if the ratings are right, the
 * side with the higher average wins about half the time and the margins are
 * symmetric. Systematic deviation is evidence about the ratings that did not
 * come from anyone's opinion — which is the one thing the comparison collector
 * cannot provide, however many raters it reaches (context.md 0).
 */

export type GameTeam = {
  players: { id: string; name: string; overall: number; position: string }[];
  average: number;
  score: number;
};

export type GameInput = {
  teams: GameTeam[];
  winner: number;
};

/**
 * Why a result cannot be recorded, or null if it can.
 *
 * Rejects rather than repairs, which is the same call `rate.mts` makes about
 * out-of-scale ratings: a winner who scored fewer points is a data-entry
 * mistake, and quietly swapping the winner to match the score hides it.
 */
export function rejectGame(input: GameInput): string | null {
  const { teams, winner } = input;
  if (teams.length !== 2) return "A game is between two teams";
  if (teams.some((t) => t.players.length === 0)) return "A team needs players";
  if (!Number.isInteger(winner) || winner < 0 || winner >= teams.length) {
    return "The winner has to be one of the two teams";
  }
  for (const team of teams) {
    if (!Number.isInteger(team.score) || team.score < 0) {
      return "A score is a whole number, zero or more";
    }
  }
  const [a, b] = teams;
  if (a.score === b.score) return "A recorded game needs a winner, so the scores cannot be level";
  const scoreLeader = a.score > b.score ? 0 : 1;
  if (scoreLeader !== winner) {
    return "The winner and the score disagree";
  }
  return null;
}

/** Points the winner won by. */
export function margin(game: GameInput): number {
  const [a, b] = game.teams;
  return Math.abs(a.score - b.score);
}

/**
 * Which side the ratings favoured: the team with the higher average, or null
 * when the two averages are identical and there was no prediction to test.
 */
export function favourite(game: GameInput): number | null {
  const [a, b] = game.teams;
  if (a.average === b.average) return null;
  return a.average > b.average ? 0 : 1;
}

export type Calibration = {
  /** Games with a favourite to test. */
  tested: number;
  /** Of those, how many the favourite won. */
  favouriteWon: number;
  /** Games where the two averages were identical, so nothing was predicted. */
  level: number;
  /** Mean winning margin when the favourite won, and when the underdog did. */
  marginWhenFavouriteWon: number | null;
  marginWhenUnderdogWon: number | null;
};

/**
 * What a set of recorded games says about the ratings.
 *
 * Deliberately descriptive rather than inferential. Turning team outcomes into
 * individual ratings is a real model and a data-hungry one — each game is one
 * observation about a ten-player split — so this reports what happened and
 * leaves fitting until there is enough to fit. Reporting a per-player number
 * off six games would be the "one person's click rendered as the group" failure
 * again, in a new costume.
 */
export function calibration(games: GameInput[]): Calibration {
  let tested = 0;
  let favouriteWon = 0;
  let level = 0;
  const favMargins: number[] = [];
  const dogMargins: number[] = [];

  for (const game of games) {
    const fav = favourite(game);
    if (fav === null) {
      level++;
      continue;
    }
    tested++;
    if (fav === game.winner) {
      favouriteWon++;
      favMargins.push(margin(game));
    } else {
      dogMargins.push(margin(game));
    }
  }

  const mean = (xs: number[]) =>
    xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;

  return {
    tested,
    favouriteWon,
    level,
    marginWhenFavouriteWon: mean(favMargins),
    marginWhenUnderdogWon: mean(dogMargins),
  };
}

/**
 * How many recorded games it takes before the favourite's win rate means
 * anything, at the given deviation from a coin flip.
 *
 * Here so nobody reads a 4-2 start as a finding. Two standard errors on a
 * proportion is the usual bar, and at p=0.5 that is n >= 1 / delta^2.
 */
export function gamesNeeded(delta: number): number {
  if (delta <= 0) return Infinity;
  return Math.ceil(1 / (delta * delta));
}
