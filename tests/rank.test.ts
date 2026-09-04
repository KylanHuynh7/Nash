import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { competitionRanks, rankLabel } from "@/lib/rank";

describe("competitionRanks", () => {
  it("numbers a clean order 1..n", () => {
    assert.deepEqual(
      competitionRanks([93, 90, 87]).map((r) => r.rank),
      [1, 2, 3],
    );
  });

  it("gives a tied pair the same rank", () => {
    // The case this exists for: Jason and Lucas both store 79.
    const ranks = competitionRanks([81, 79, 79, 78]);
    assert.deepEqual(ranks.map((r) => r.rank), [1, 2, 2, 4]);
  });

  it("skips the ranks a tie consumed, so the last rank equals the count", () => {
    const ranks = competitionRanks([90, 79, 79, 79, 70]);
    assert.deepEqual(ranks.map((r) => r.rank), [1, 2, 2, 2, 5]);
  });

  it("marks every member of a tie, and nobody else", () => {
    assert.deepEqual(
      competitionRanks([81, 79, 79, 78]).map((r) => r.tied),
      [false, true, true, false],
    );
  });

  it("handles a tie at the very top", () => {
    const ranks = competitionRanks([93, 93, 87]);
    assert.deepEqual(ranks.map((r) => r.rank), [1, 1, 3]);
    assert.deepEqual(ranks.map((r) => r.tied), [true, true, false]);
  });

  it("handles a tie at the very bottom", () => {
    const ranks = competitionRanks([93, 66, 66]);
    assert.deepEqual(ranks.map((r) => r.rank), [1, 2, 2]);
  });

  it("handles a roster where everyone is level", () => {
    const ranks = competitionRanks([75, 75, 75]);
    assert.deepEqual(ranks.map((r) => r.rank), [1, 1, 1]);
    assert.ok(ranks.every((r) => r.tied));
  });

  it("handles one player and none", () => {
    assert.deepEqual(competitionRanks([90]), [{ rank: 1, tied: false }]);
    assert.deepEqual(competitionRanks([]), []);
  });

  it("ranks by position, not by value — an unsorted array is the caller's bug", () => {
    // Documented rather than defended: the caller's sort is what the reader
    // sees, so sorting here would let the list and the numbers disagree.
    assert.deepEqual(
      competitionRanks([70, 90, 80]).map((r) => r.rank),
      [1, 2, 3],
    );
  });
});

describe("rankLabel", () => {
  it("is a bare number when nobody shares the rank", () => {
    assert.equal(rankLabel({ rank: 7, tied: false }), "7");
  });

  it("takes a T when the rank is shared", () => {
    assert.equal(rankLabel({ rank: 7, tied: true }), "T7");
  });

  it("stays short at two digits, which is what the column has room for", () => {
    assert.equal(rankLabel({ rank: 11, tied: true }).length, 3);
  });
});
