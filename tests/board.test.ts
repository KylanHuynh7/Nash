import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  BENCH,
  boardSpread,
  findContainer,
  move,
  pinToSpot,
  swap,
  teamAverage,
  teamId,
  type Board,
} from "@/lib/board";
import { buildMatchups } from "@/lib/lineup";
import { SPORTS } from "@/lib/sports";
import { basketballPool, byName } from "./fixtures";

const config = SPORTS.basketball;

/** A five-a-side board with three left over, drawn from the real roster. */
function board(): Board {
  const pool = basketballPool();
  const pick = (...names: string[]) => names.map((n) => byName(pool, n));
  return {
    teams: [
      pick("Taha", "Joe", "Jason", "Lucas", "Danny"),
      pick("Brendan", "Victor", "Kylan", "Rayan", "Brian"),
    ],
    bench: pick("Orion", "Eric", "Sean"),
    pinned: {},
  };
}

const sizes = (b: Board) => b.teams.map((t) => t.length);
const names = (b: Board, team: number) => b.teams[team].map((p) => p.name).sort();
const where = (b: Board, name: string) => {
  const pool = [...b.teams.flat(), ...b.bench];
  const p = pool.find((x) => x.name === name);
  return p ? findContainer(b, p.id) : null;
};
/** The spot a player is standing on, read off the rendered lineup. */
const spotOf = (b: Board, name: string): string | null => {
  const team = b.teams.findIndex((t) => t.some((p) => p.name === name));
  if (team === -1) return null;
  return (
    buildMatchups(config, b.teams, b.pinned).find(
      (m) => m.players[team]?.name === name,
    )?.position ?? null
  );
};

describe("swap", () => {
  it("trades two players across sides and keeps both rosters the same size", () => {
    const before = board();
    const after = swap(before, config, "joe", "kylan");

    assert.deepEqual(sizes(after), sizes(before), "team sizes changed");
    assert.equal(where(after, "Joe"), teamId(1));
    assert.equal(where(after, "Kylan"), teamId(0));
    // Nobody else moved.
    assert.deepEqual(
      names(after, 0),
      ["Danny", "Jason", "Kylan", "Lucas", "Taha"],
    );
  });

  it("substitutes a benched player without changing team sizes", () => {
    // The case `move` cannot express: bringing someone on for someone else.
    const before = board();
    const after = swap(before, config, "orion", "danny");

    assert.deepEqual(sizes(after), sizes(before));
    assert.equal(where(after, "Orion"), teamId(0));
    assert.equal(where(after, "Danny"), BENCH);
    assert.equal(after.bench.length, before.bench.length);
  });

  it("keeps every player exactly once", () => {
    const before = board();
    const after = swap(before, config, "taha", "brian");
    const all = [...after.teams.flat(), ...after.bench].map((p) => p.id).sort();
    const was = [...before.teams.flat(), ...before.bench].map((p) => p.id).sort();
    assert.deepEqual(all, was);
    assert.equal(new Set(all).size, all.length, "a player was duplicated");
  });

  it("has the two players trade the spots they were standing on", () => {
    const before = board();
    const joeSpot = spotOf(before, "Joe");
    const kylanSpot = spotOf(before, "Kylan");
    assert.ok(joeSpot && kylanSpot);

    const after = swap(before, config, "joe", "kylan");
    assert.equal(spotOf(after, "Joe"), kylanSpot, "Joe did not take Kylan's spot");
    assert.equal(spotOf(after, "Kylan"), joeSpot, "Kylan did not take Joe's spot");
  });

  it("drops the pin of whoever goes to the bench", () => {
    // There are no spots on the bench to hold a pin, and a stale one would
    // place him the moment he came back on.
    const before = board();
    const after = swap(before, config, "orion", "danny");
    assert.ok(!("danny" in after.pinned), "a benched player kept a pin");
    assert.equal(after.pinned["orion"], spotOf(before, "Danny"));
  });

  it("moves exactly two people and leaves the rest of the lineup alone", () => {
    const before = board();
    const wasAt = new Map(
      [...before.teams.flat()].map((p) => [p.name, spotOf(before, p.name)]),
    );
    const after = swap(before, config, "joe", "kylan");
    for (const p of after.teams.flat()) {
      if (p.name === "Joe" || p.name === "Kylan") continue;
      assert.equal(
        spotOf(after, p.name),
        wasAt.get(p.name),
        `${p.name} was moved by a swap he was not part of`,
      );
    }
  });

  /*
   * The case the browser found and the unit tests did not.
   *
   * Pinning only the two who moved leaves everyone else to automatic
   * placement, which re-derives because a swap changes what each side is made
   * of. Trading a point guard off Red sent Victor from centre to point and
   * Justin the other way - two players nobody touched. The lineup a swap
   * leaves behind has to be the one it found, apart from the two who traded.
   */
  it("moves nobody but the two, even when the trade would re-derive placement", () => {
    const pool = basketballPool();
    const pick = (...names: string[]) => names.map((n) => byName(pool, n));
    // Two point guards on opposite sides, and heights spread enough that the
    // settling pass has something to do once one of them leaves.
    const before: Board = {
      teams: [
        pick("Taha", "Victor", "Alfonso", "Bang", "Justin"),
        pick("Kylan", "Lucas", "Danny", "David", "Eric"),
      ],
      bench: [],
      pinned: {},
    };
    const wasAt = new Map(
      before.teams.flat().map((p) => [p.name, spotOf(before, p.name)]),
    );

    const after = swap(before, config, "taha", "danny");

    for (const p of after.teams.flat()) {
      if (p.name === "Taha" || p.name === "Danny") continue;
      assert.equal(
        spotOf(after, p.name),
        wasAt.get(p.name),
        `${p.name} moved from ${wasAt.get(p.name)} to ${spotOf(after, p.name)} in a swap he was not part of`,
      );
    }
    assert.equal(spotOf(after, "Taha"), wasAt.get("Danny"));
    assert.equal(spotOf(after, "Danny"), wasAt.get("Taha"));
  });

  it("holds the lineup steady across a run of swaps", () => {
    // Each swap freezes both sides, so a second one must not undo the first.
    let b = board();
    const first = spotOf(b, "Jason");
    b = swap(b, config, "taha", "kylan");
    b = swap(b, config, "orion", "lucas");
    assert.equal(spotOf(b, "Jason"), first, "an unrelated player drifted");
  });

  it("is its own inverse", () => {
    const before = board();
    const there = swap(before, config, "joe", "kylan");
    const back = swap(there, config, "joe", "kylan");
    assert.deepEqual(names(back, 0), names(before, 0));
    assert.deepEqual(names(back, 1), names(before, 1));
  });

  it("does nothing for two players on the same side", () => {
    // That is rearranging one lineup, which is pinToSpot's job.
    const before = board();
    assert.equal(swap(before, config, "taha", "joe"), before);
  });

  it("does nothing for a player swapped with himself, or for a stranger", () => {
    const before = board();
    assert.equal(swap(before, config, "taha", "taha"), before);
    assert.equal(swap(before, config, "taha", "nobody"), before);
    assert.equal(swap(before, config, "ghost", "phantom"), before);
  });

  it("never consults position - a guard can be traded for a centre", () => {
    const before = board();
    const jason = byName(basketballPool(), "Jason"); // c
    const brian = byName(basketballPool(), "Brian"); // pg
    assert.notEqual(jason.position, brian.position);
    const after = swap(before, config, "jason", "brian");
    assert.equal(where(after, "Jason"), teamId(1));
    assert.equal(where(after, "Brian"), teamId(0));
  });

  it("keeps each side sorted strongest first", () => {
    const after = swap(board(), config, "danny", "brendan");
    for (const team of after.teams) {
      const overalls = team.map((p) => p.overall);
      assert.deepEqual(overalls, [...overalls].sort((a, b) => b - a));
    }
  });

  it("keeps the bench in queue order rather than sorting it", () => {
    // The bench is who has waited longest, not a ranking. Sorting it by
    // rating would quietly reorder who comes on next.
    const before = board();
    const order = before.bench.map((p) => p.name);
    const after = swap(before, config, "orion", "danny");
    const expected = order.map((n) => (n === "Orion" ? "Danny" : n));
    assert.deepEqual(after.bench.map((p) => p.name), expected);
  });
});

describe("move", () => {
  it("changes team sizes, which is the difference from a swap", () => {
    const after = move(board(), "joe", teamId(1));
    assert.deepEqual(sizes(after), [4, 6]);
  });

  it("sends a player to the bench", () => {
    const after = move(board(), "joe", BENCH);
    assert.equal(where(after, "Joe"), BENCH);
    assert.deepEqual(sizes(after), [4, 5]);
  });

  it("drops the pin, because the spot belonged to the old side", () => {
    const before = { ...board(), pinned: { joe: "c" } };
    const after = move(before, "joe", teamId(1));
    assert.ok(!("joe" in after.pinned));
  });

  it("does nothing when the destination is where he already is", () => {
    const before = board();
    assert.equal(move(before, "joe", teamId(0)), before);
    assert.equal(move(before, "nobody", teamId(1)), before);
  });
});

describe("pinToSpot", () => {
  it("swaps two players within one lineup and pins both", () => {
    const before = board();
    const target = spotOf(before, "Danny")!;
    const from = spotOf(before, "Taha")!;
    const after = pinToSpot(before, config, "taha", target);
    assert.equal(spotOf(after, "Taha"), target);
    assert.equal(spotOf(after, "Danny"), from);
    assert.deepEqual(sizes(after), sizes(before), "a lineup change moved teams");
  });

  it("refuses a benched player, who has not said which side he is joining", () => {
    const before = board();
    assert.equal(pinToSpot(before, config, "orion", "pg"), before);
  });

  it("does nothing when the player is already there", () => {
    const before = board();
    const at = spotOf(before, "Taha")!;
    assert.equal(pinToSpot(before, config, "taha", at), before);
  });
});

describe("board arithmetic", () => {
  it("averages a team and reports the spread", () => {
    const b = board();
    assert.equal(teamAverage(b.teams[0]), teamAverage(b.teams[0]));
    assert.equal(teamAverage([]), 0);
    assert.ok(boardSpread(b) >= 0);
  });

  it("ignores empty teams in the spread", () => {
    const b: Board = { teams: [[], []], bench: [], pinned: {} };
    assert.equal(boardSpread(b), 0);
  });

  it("a swap changes the spread but a lineup rearrangement does not", () => {
    const before = board();
    const traded = swap(before, config, "taha", "brian");
    assert.notEqual(boardSpread(traded), boardSpread(before));

    const rearranged = pinToSpot(before, config, "taha", spotOf(before, "Danny")!);
    assert.equal(boardSpread(rearranged), boardSpread(before));
  });
});
