import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  SESSION_TARGET,
  anchorPairs,
  availablePairs,
  blockTargets,
  nextPair,
  pairKey,
  seedFor,
} from "@/lib/compare";
import type { ComparePlayer } from "@/lib/compare";
import { basketballPool } from "./fixtures";

const pool: ComparePlayer[] = basketballPool().map((p) => ({
  id: p.id,
  name: p.name,
  // The "overall" axis steers on the overall. Other axes steer on their own
  // attribute, which is the same field carrying a different number.
  estimate: p.overall,
}));

/** Answer questions the way a rater would, and hand back what was asked. */
function runSession(raterId: string | null, count: number, useAnchors = true) {
  const answered = new Set<string>();
  const seen: Record<string, number> = {};
  const anchors = useAnchors ? anchorPairs(pool) : undefined;
  const asked: { left: ComparePlayer; right: ComparePlayer }[] = [];
  for (let i = 0; i < count; i++) {
    const pair = nextPair({
      pool,
      raterId,
      answered,
      seen,
      seed: seedFor(raterId, i),
      anchors,
    });
    if (!pair) break;
    asked.push(pair);
    answered.add(pairKey(pair.left.id, pair.right.id));
    seen[pair.left.id] = (seen[pair.left.id] ?? 0) + 1;
    seen[pair.right.id] = (seen[pair.right.id] ?? 0) + 1;
  }
  return asked;
}

describe("pairKey", () => {
  it("is order-free, so a pair has one identity", () => {
    assert.equal(pairKey("a", "b"), pairKey("b", "a"));
  });

  it("distinguishes different pairs", () => {
    assert.notEqual(pairKey("a", "b"), pairKey("a", "c"));
  });
});

describe("nextPair", () => {
  /*
   * The filter that must never silently lapse. Self-assessment in a friend
   * group is large and one-directional, so it is refused in the picker, in the
   * server action, and again in the fit. This covers the first of the three.
   */
  it("never asks a rater about themselves", () => {
    for (const rater of ["taha", "kylan", "justin"]) {
      const asked = runSession(rater, 200);
      const involvesSelf = asked.filter(
        (p) => p.left.id === rater || p.right.id === rater,
      );
      assert.deepEqual(
        involvesSelf,
        [],
        `${rater} was asked about himself ${involvesSelf.length} times`,
      );
    }
  });

  it("never repeats a pair within a sitting", () => {
    const asked = runSession("kylan", 200);
    const keys = asked.map((p) => pairKey(p.left.id, p.right.id));
    assert.equal(new Set(keys).size, keys.length, "a pair was asked twice");
  });

  it("runs dry exactly at the number of pairs available", () => {
    const asked = runSession("kylan", 500);
    assert.equal(asked.length, availablePairs(pool.length, true));
  });

  it("returns null rather than looping once everything is answered", () => {
    const answered = new Set<string>();
    for (let i = 0; i < pool.length; i++)
      for (let j = i + 1; j < pool.length; j++)
        answered.add(pairKey(pool[i].id, pool[j].id));
    const pair = nextPair({
      pool,
      raterId: null,
      answered,
      seen: {},
      seed: 1,
    });
    assert.equal(pair, null);
  });

  it("covers the roster rather than fixating on a few names", () => {
    // Coverage weighting exists so the model is not confident about one player
    // and guessing about another.
    const asked = runSession("kylan", 60);
    const seen: Record<string, number> = {};
    for (const p of asked) {
      seen[p.left.id] = (seen[p.left.id] ?? 0) + 1;
      seen[p.right.id] = (seen[p.right.id] ?? 0) + 1;
    }
    const others = pool.filter((p) => p.id !== "kylan");
    for (const p of others) {
      assert.ok(seen[p.id] > 0, `${p.name} never came up in 60 questions`);
    }
    const counts = others.map((p) => seen[p.id] ?? 0);
    assert.ok(
      Math.max(...counts) - Math.min(...counts) <= 8,
      `coverage was lopsided: ${Math.min(...counts)}..${Math.max(...counts)}`,
    );
  });

  it("is deterministic, so a reload does not reshuffle the question", () => {
    const a = runSession("kylan", 25);
    const b = runSession("kylan", 25);
    assert.deepEqual(
      a.map((p) => [p.left.id, p.right.id]),
      b.map((p) => [p.left.id, p.right.id]),
    );
  });

  it("shows both presentation orders, so side preference stays measurable", () => {
    // If the picker always named the stronger player first, a side bias would
    // be indistinguishable from agreement with the existing ratings.
    const asked = runSession("kylan", 60);
    const strongerOnLeft = asked.filter(
      (p) => p.left.estimate > p.right.estimate,
    ).length;
    const ratio = strongerOnLeft / asked.length;
    assert.ok(
      ratio > 0.25 && ratio < 0.75,
      `presentation order is lopsided: stronger-on-left ${(ratio * 100).toFixed(0)}%`,
    );
  });

  it("asks the anchor set before anything random", () => {
    const anchors = new Set(anchorPairs(pool));
    const asked = runSession("kylan", anchors.size);
    // Anchors involving the rater can never be asked, so allow for those.
    const anchorsWithoutRater = [...anchors].filter(
      (k) => !k.split(":").includes("kylan"),
    );
    const askedKeys = asked.map((p) => pairKey(p.left.id, p.right.id));
    const fromAnchors = askedKeys.filter((k) => anchors.has(k)).length;
    assert.ok(
      fromAnchors >= anchorsWithoutRater.length,
      `only ${fromAnchors} of ${anchorsWithoutRater.length} anchors came first`,
    );
  });
});

describe("anchorPairs", () => {
  it("pairs each player with his neighbour on the ladder", () => {
    const keys = new Set(anchorPairs(pool));
    const ladder = [...pool].sort((a, b) => b.estimate - a.estimate || (a.id < b.id ? -1 : 1));
    for (let i = 0; i + 1 < ladder.length; i++) {
      assert.ok(
        keys.has(pairKey(ladder[i].id, ladder[i + 1].id)),
        `${ladder[i].name} vs ${ladder[i + 1].name} is not an anchor`,
      );
    }
  });

  it("ties the top of the ladder to the bottom", () => {
    const keys = new Set(anchorPairs(pool));
    const ladder = [...pool].sort((a, b) => b.estimate - a.estimate || (a.id < b.id ? -1 : 1));
    assert.ok(
      keys.has(pairKey(ladder[0].id, ladder[ladder.length - 1].id)),
      "nothing anchors the best player to the worst",
    );
  });

  it("is the same set for every rater, which is what makes agreement measurable", () => {
    assert.deepEqual(anchorPairs(pool), anchorPairs([...pool].reverse()));
  });

  it("contains no duplicates", () => {
    const keys = anchorPairs(pool);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("handles pools too small to anchor", () => {
    assert.deepEqual(anchorPairs([]), []);
    assert.deepEqual(anchorPairs(pool.slice(0, 1)), []);
    assert.equal(anchorPairs(pool.slice(0, 2)).length, 1);
  });
});

describe("availablePairs", () => {
  it("excludes the rater from his own pool", () => {
    assert.equal(availablePairs(17, true), (16 * 15) / 2);
    assert.equal(availablePairs(17, false), (17 * 16) / 2);
  });

  it("explains why football cannot reach the session target", () => {
    // Twelve players leaves a rater 55 pairs, so a flat bar to 60 would never
    // fill. The UI caps the target at this number.
    const football = availablePairs(12, true);
    assert.equal(football, 55);
    assert.ok(football < SESSION_TARGET);
  });

  it("never goes negative", () => {
    // `=== 0` rather than assert.equal: a one-player pool computes (0 * -1) / 2,
    // which is -0. Harmless - it renders as "0" and compares equal - but
    // strictEqual distinguishes it, so say what is actually meant.
    assert.ok(availablePairs(0, true) === 0);
    assert.ok(availablePairs(1, true) === 0);
    assert.ok(availablePairs(2, true) === 0);
  });
});

describe("round budget", () => {
  it("is capped at 80 and nobody may exceed it", () => {
    // A fixed ceiling, not a suggestion. The old flow offered +20 at a time and
    // two of five raters took it; a multi-axis round divides one budget between
    // its axes, so an open target would let an eager rater pile answers onto
    // whichever block they were in and skew the comparison the split exists to
    // make.
    assert.equal(SESSION_TARGET, 80);
    for (const axes of [1, 2, 3, 4, 5]) {
      const total = blockTargets(axes, pool.length).reduce((a, b) => a + b, 0);
      assert.ok(total <= SESSION_TARGET, `${axes} axes summed to ${total}`);
    }
  });

  it("spends the whole budget when the pool allows", () => {
    // 80 across three axes is 27/27/26, not 26/26/26 and four questions short.
    assert.deepEqual(blockTargets(3, pool.length), [27, 27, 26]);
    assert.deepEqual(blockTargets(1, pool.length), [80]);
    assert.deepEqual(blockTargets(2, pool.length), [40, 40]);
    assert.equal(
      blockTargets(3, pool.length).reduce((a, b) => a + b, 0),
      SESSION_TARGET,
    );
  });

  it("never promises more questions than a rater has pairs", () => {
    // The same trap the single-axis target had: a rater cannot answer more
    // pairs than exist, and a bar counting toward one would never fill.
    const tiny = 6; // 5 others -> 10 pairs
    const targets = blockTargets(3, tiny);
    assert.ok(
      targets.every((t) => t <= availablePairs(tiny, true)),
      `promised ${targets} of ${availablePairs(tiny, true)} available`,
    );
  });

  it("gives an empty round no blocks", () => {
    assert.deepEqual(blockTargets(0, pool.length), []);
  });
});

describe("comp blocks", () => {
  it("costs one question per subject, never counting the rater", () => {
    // A comp is one question per PLAYER, not per pair - which is exactly why
    // it is affordable where a per-axis pairwise verdict is not (context.md
    // 6l). Seventeen players give a rater sixteen questions.
    const [comp] = blockTargets([{ mode: "comp" }], 17);
    assert.equal(comp, 16);
  });

  it("does not take a share of the session budget", () => {
    // Folding it into the shared division would silently shrink every
    // comparative block and redefine "complete" for raters who already
    // finished - the same failure tick blocks were kept out of.
    const withoutComp = blockTargets([{}, {}, {}], 17, 80);
    const withComp = blockTargets([{}, {}, {}, { mode: "comp" }], 17, 80);
    assert.deepEqual(withComp.slice(0, 3), withoutComp);
  });

  it("respects a restricted slate", () => {
    const [comp] = blockTargets(
      [{ mode: "comp", poolNames: ["A", "B", "C", "D"] }],
      17,
    );
    assert.equal(comp, 3);
  });

  it("asks nothing of a roster of one", () => {
    assert.deepEqual(blockTargets([{ mode: "comp" }], 1), [0]);
  });
});
