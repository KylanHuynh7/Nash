import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { basketballRows } from "./fixtures";
import {
  WEIGHT_MAX,
  decodeWeights,
  encodeWeights,
  families,
  isChanged,
  officialWeights,
  playgroundBoard,
  sandboxOverall,
} from "@/lib/playground";
import { SPORTS, computeOverall } from "@/lib/sports";

const basketball = SPORTS.basketball;
const football = SPORTS.football;

/** The real seventeen, with overalls recomputed so the fixture cannot drift. */
const roster = basketballRows.map((r) => ({
  id: r.name,
  name: r.name,
  ratings: r.ratings,
  overall: computeOverall(basketball, r.ratings),
}));

describe("families", () => {
  it("sums each family's attribute weights, heaviest first", () => {
    const list = families(basketball);
    assert.equal(list[0].name, "Physicals");
    assert.ok(Math.abs(list[0].weight - 1.25) < 1e-9);
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i - 1].weight >= list[i].weight);
    }
  });

  it("gives an attribute outside the overall no weight", () => {
    // A slider for it would move nothing, which reads as broken.
    const scored = football.attributes
      .filter((a) => a.inOverall !== false)
      .reduce((s, a) => s + a.weight, 0);
    const listed = families(football).reduce((s, f) => s + f.weight, 0);
    assert.ok(football.attributes.some((a) => a.inOverall === false));
    assert.ok(Math.abs(scored - listed) < 1e-9);
  });
});

describe("sandboxOverall", () => {
  it("reproduces the official overall exactly when nothing moved", () => {
    // The whole premise: an untouched playground must show the real board, or
    // every row carries a movement arrow nobody caused.
    const official = officialWeights(basketball);
    for (const p of roster) {
      assert.equal(sandboxOverall(basketball, p.ratings, official), p.overall, p.name);
    }
  });

  it("does the same for a sport with an attribute outside the overall", () => {
    const official = officialWeights(football);
    const ratings = Object.fromEntries(
      football.attributes.map((a, i) => [a.key, 65 + ((i * 7) % 35)]),
    );
    assert.equal(
      sandboxOverall(football, ratings, official),
      computeOverall(football, ratings),
    );
  });

  it("moves a shooter up when shooting counts for more", () => {
    const ratings = Object.fromEntries(basketball.attributes.map((a) => [a.key, 70]));
    ratings.three_point = 99;
    ratings.mid_range = 99;
    const official = officialWeights(basketball);
    const before = sandboxOverall(basketball, ratings, official)!;
    const after = sandboxOverall(basketball, ratings, { ...official, Shooting: WEIGHT_MAX })!;
    assert.ok(after > before);
  });

  it("returns null when every weight is zero, rather than a made-up 80", () => {
    const zero = Object.fromEntries(families(basketball).map((f) => [f.name, 0]));
    assert.equal(sandboxOverall(basketball, roster[0].ratings, zero), null);
    assert.equal(playgroundBoard(basketball, roster, zero), null);
  });
});

describe("playgroundBoard", () => {
  it("reports no movement on an untouched board", () => {
    const board = playgroundBoard(basketball, roster, officialWeights(basketball))!;
    assert.equal(board.length, roster.length);
    for (const row of board) {
      assert.equal(row.moved, 0, row.player.name);
      assert.equal(row.sandbox, row.official);
    }
  });

  it("shares a rank across a tie on both sides", () => {
    const tied = [
      { id: "a", name: "A", overall: 80, ratings: {} },
      { id: "b", name: "B", overall: 80, ratings: {} },
    ];
    const board = playgroundBoard(basketball, tied, officialWeights(basketball))!;
    assert.deepEqual(board.map((r) => r.sandboxRank.rank), [1, 1]);
    assert.deepEqual(board.map((r) => r.moved), [0, 0]);
  });

  it("keeps movement balanced: places gained equal places lost", () => {
    const official = officialWeights(basketball);
    const board = playgroundBoard(basketball, roster, { ...official, Shooting: WEIGHT_MAX, Physicals: 0 })!;
    // Ties can absorb a place, so this is a bound rather than exact zero.
    const net = board.reduce((s, r) => s + r.moved, 0);
    assert.ok(Math.abs(net) <= roster.length);
    assert.ok(board.some((r) => r.moved !== 0));
  });
});

describe("encodeWeights / decodeWeights", () => {
  it("encodes nothing for the official weights", () => {
    assert.equal(encodeWeights(basketball, officialWeights(basketball)), "");
    assert.equal(isChanged(basketball, officialWeights(basketball)), false);
  });

  it("round-trips only the families that moved", () => {
    const weights = { ...officialWeights(basketball), Shooting: 1.5, Defense: 0.8 };
    const encoded = encodeWeights(basketball, weights);
    assert.equal(encoded, "defense-0.8_shooting-1.5");
    assert.deepEqual(decodeWeights(basketball, encoded), weights);
  });

  it("drops a mangled fragment instead of refusing the link", () => {
    const decoded = decodeWeights(basketball, "shooting-2_nonsense_bogus-1_defense-abc");
    assert.ok(decoded);
    assert.equal(decoded.Shooting, 2);
    assert.equal(decoded.Defense, officialWeights(basketball).Defense);
  });

  it("clamps and snaps to the slider", () => {
    const decoded = decodeWeights(basketball, "shooting-40_defense-0.83");
    assert.ok(decoded);
    assert.equal(decoded.Shooting, WEIGHT_MAX);
    assert.equal(decoded.Defense, 0.85);
  });

  it("is null when the link moves nothing", () => {
    assert.equal(decodeWeights(basketball, ""), null);
    assert.equal(decodeWeights(basketball, "shooting-1.05"), null);
  });
});
