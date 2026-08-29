import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  calibration,
  favourite,
  gamesNeeded,
  margin,
  rejectGame,
  type GameInput,
} from "@/lib/games";

function team(average: number, score: number, n = 5) {
  return {
    players: Array.from({ length: n }, (_, i) => ({
      id: `p${average}-${i}`,
      name: `P${i}`,
      overall: Math.round(average),
      position: "pg",
    })),
    average,
    score,
  };
}

function game(a: number, b: number, scoreA: number, scoreB: number): GameInput {
  return {
    teams: [team(a, scoreA), team(b, scoreB)],
    winner: scoreA > scoreB ? 0 : 1,
  };
}

describe("rejectGame", () => {
  it("accepts an ordinary result", () => {
    assert.equal(rejectGame(game(80, 80.1, 11, 7)), null);
  });

  it("refuses a result with no score behind it", () => {
    // Requiring the score is what makes this flow deliberate, and what keeps it
    // distinct from the winner-stays-on buttons.
    const level = game(80, 80, 11, 11);
    assert.ok(rejectGame(level));
  });

  it("refuses a winner the score contradicts, rather than repairing it", () => {
    // Same call rate.mts makes about an out-of-scale rating: quietly swapping
    // the winner to match the score would hide a data-entry mistake.
    const wrong: GameInput = { teams: [team(80, 7), team(80, 11)], winner: 0 };
    assert.equal(rejectGame(wrong), "The winner and the score disagree");
  });

  it("refuses a winner who is not one of the two teams", () => {
    assert.ok(rejectGame({ teams: [team(80, 11), team(80, 7)], winner: 2 }));
    assert.ok(rejectGame({ teams: [team(80, 11), team(80, 7)], winner: -1 }));
  });

  it("refuses an empty team and a one-sided game", () => {
    assert.ok(
      rejectGame({
        teams: [team(80, 11), { players: [], average: 0, score: 7 }],
        winner: 0,
      }),
    );
    assert.ok(rejectGame({ teams: [team(80, 11)], winner: 0 }));
  });

  it("refuses a score that is not a whole number of points", () => {
    assert.ok(rejectGame({ teams: [team(80, 11.5), team(80, 7)], winner: 0 }));
    assert.ok(rejectGame({ teams: [team(80, 11), team(80, -1)], winner: 0 }));
  });

  it("accepts a shutout, which is a real result", () => {
    assert.equal(rejectGame(game(80, 79, 11, 0)), null);
  });
});

describe("favourite", () => {
  it("is the higher average, and nothing when the two are level", () => {
    assert.equal(favourite(game(81, 80, 11, 7)), 0);
    assert.equal(favourite(game(80, 81, 11, 7)), 1);
    assert.equal(favourite(game(80, 80, 11, 7)), null);
  });
});

describe("calibration", () => {
  it("counts only games that had a prediction to test", () => {
    // A level matchup predicts nothing, so it cannot be evidence either way.
    const c = calibration([
      game(81, 80, 11, 7), // favourite won
      game(80, 81, 11, 7), // underdog won
      game(80, 80, 11, 7), // level, no prediction
    ]);
    assert.equal(c.tested, 2);
    assert.equal(c.favouriteWon, 1);
    assert.equal(c.level, 1);
  });

  it("separates the margins by who won", () => {
    const c = calibration([
      game(81, 80, 11, 5), // favourite by 6
      game(81, 80, 11, 9), // favourite by 2
      game(80, 81, 11, 8), // underdog by 3
    ]);
    assert.equal(c.marginWhenFavouriteWon, 4);
    assert.equal(c.marginWhenUnderdogWon, 3);
  });

  it("reports nothing rather than zero when a side never won", () => {
    // A mean over no games is absent, not 0 - and 0 would read as "the
    // underdog won by nothing", which is a different and false claim.
    const c = calibration([game(81, 80, 11, 5)]);
    assert.equal(c.marginWhenUnderdogWon, null);
  });

  it("is empty on no games", () => {
    const c = calibration([]);
    assert.equal(c.tested, 0);
    assert.equal(c.marginWhenFavouriteWon, null);
  });
});

describe("margin", () => {
  it("is the points the winner won by, whichever side that was", () => {
    assert.equal(margin(game(81, 80, 11, 7)), 4);
    assert.equal(margin(game(80, 81, 7, 11)), 4);
  });
});

describe("gamesNeeded", () => {
  it("says how many games a deviation needs before it means anything", () => {
    // Two standard errors at p=0.5, so a 10-point deviation from a coin flip
    // wants 100 games. Here so nobody reads a 4-2 start as a finding.
    assert.equal(gamesNeeded(0.1), 100);
    assert.equal(gamesNeeded(0.2), 25);
    assert.equal(gamesNeeded(0), Infinity);
  });
});
