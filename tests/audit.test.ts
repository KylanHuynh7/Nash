import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  buildMatrix,
  column,
  componentsToReach,
  correlationPairs,
  correlationWith,
  orderOf,
  pearson,
  principalComponents,
  residuals,
  sharedValues,
  weightSensitivity,
  weightedScores,
} from "@/lib/audit";
import type { AuditMatrix } from "@/lib/audit";

/*
 * Synthetic throughout, and deliberately so. These functions exist to make
 * claims about a real sheet - "this column is a copy of that one", "four
 * components explain ninety percent" - and a claim is only checkable against
 * data whose right answer is known in advance. The real roster is where the
 * findings live; it is not where the maths gets verified.
 */

/** Deterministic PRNG. Integer ops only, per the hydration lesson. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const near = (actual: number, expected: number, tol = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) < tol,
    `expected ${expected}, got ${actual}`,
  );

/**
 * Four players, three attributes, chosen so every relationship is exact:
 *  - `copy` is a linear transform of `base`, so they correlate at exactly 1
 *  - `other` is orthogonal to both, so it correlates at exactly 0
 */
const exact: AuditMatrix = {
  keys: ["base", "copy", "other"],
  names: ["A", "B", "C", "D"],
  values: [
    [1, 3, 1],
    [1, 3, -1],
    [-1, 1, 1],
    [-1, 1, -1],
  ],
};

describe("pearson", () => {
  it("is 1 for a column against itself", () => {
    near(pearson([1, 2, 3], [1, 2, 3])!, 1);
  });

  it("is 1 for a linear transform, which is what a copied column looks like", () => {
    near(pearson([1, 2, 3], [7, 9, 11])!, 1);
  });

  it("is -1 when the order is exactly reversed", () => {
    near(pearson([1, 2, 3], [3, 2, 1])!, -1);
  });

  it("is 0 for orthogonal columns", () => {
    near(pearson([1, 1, -1, -1], [1, -1, 1, -1])!, 0);
  });

  it("is null rather than zero when a column is constant", () => {
    // A column where everyone holds the same number has no order to agree
    // with. Zero would read as "independent", which is a different claim.
    assert.equal(pearson([5, 5, 5], [1, 2, 3]), null);
  });

  it("refuses mismatched lengths", () => {
    assert.throws(() => pearson([1, 2], [1, 2, 3]));
  });
});

describe("correlationPairs", () => {
  it("puts the duplicated pair first and finds it at 1", () => {
    const pairs = correlationPairs(exact);
    assert.equal(pairs[0].a, "base");
    assert.equal(pairs[0].b, "copy");
    near(pairs[0].r, 1);
  });

  it("covers every pair exactly once", () => {
    assert.equal(correlationPairs(exact).length, 3);
  });

  it("ranks by magnitude, so a strong inverse outranks a weak positive", () => {
    const m: AuditMatrix = {
      keys: ["x", "down", "noise"],
      names: ["A", "B", "C", "D"],
      values: [
        [1, 9, 1],
        [2, 8, 3],
        [3, 7, 2],
        [4, 6, 5],
      ],
    };
    const [first] = correlationPairs(m);
    assert.equal(first.b, "down");
    near(first.r, -1);
  });
});

describe("correlationWith", () => {
  it("scores every attribute against an outside vector", () => {
    const out = correlationWith(exact, [10, 10, -10, -10]);
    near(out.find((o) => o.key === "base")!.r!, 1);
    near(out.find((o) => o.key === "other")!.r!, 0);
  });
});

describe("residuals", () => {
  it("leaves nothing when one column is a transform of the other", () => {
    // The whole point of the measure: a copied column carries no information
    // its source does not already have.
    const { spread } = residuals(column(exact, "copy"), column(exact, "base"));
    near(spread, 0);
  });

  it("keeps the full spread when the columns are independent", () => {
    const { spread } = residuals(column(exact, "other"), column(exact, "base"));
    near(spread, 2);
  });

  it("survives a constant predictor by returning no residual at all", () => {
    const { spread } = residuals([1, 2, 3], [4, 4, 4]);
    near(spread, 0);
  });
});

describe("sharedValues", () => {
  const m: AuditMatrix = {
    keys: ["tied", "clean"],
    names: ["A", "B", "C", "D"],
    values: [
      [80, 1],
      [80, 2],
      [80, 3],
      [70, 4],
    ],
  };

  it("reports a value three players share", () => {
    const found = sharedValues(m);
    assert.equal(found.length, 1);
    assert.equal(found[0].key, "tied");
    assert.equal(found[0].value, 80);
    assert.deepEqual(found[0].names, ["A", "B", "C"]);
  });

  it("ignores a pair, because two players agreeing is not a signature", () => {
    assert.equal(sharedValues(m, 4).length, 0);
  });

  it("finds a floor shared by everyone", () => {
    const flat: AuditMatrix = {
      keys: ["x"],
      names: ["A", "B", "C"],
      values: [[65], [65], [65]],
    };
    assert.equal(sharedValues(flat)[0].names.length, 3);
  });
});

describe("principalComponents", () => {
  it("collapses a duplicated column onto one component", () => {
    // base and copy are the same signal, so they share one eigenvalue of 2;
    // other stands alone at 1. Two thirds and one third, exactly.
    const { variance } = principalComponents(exact);
    near(variance[0], 2 / 3, 1e-9);
    near(variance[1], 1 / 3, 1e-9);
    near(variance[2], 0, 1e-9);
  });

  it("spreads variance evenly across genuinely independent columns", () => {
    const orthogonal: AuditMatrix = {
      keys: ["x", "y", "z"],
      names: ["A", "B", "C", "D"],
      values: [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ],
    };
    const { variance } = principalComponents(orthogonal);
    for (const v of variance) near(v, 1 / 3, 1e-9);
  });

  it("loads the duplicated pair together and the independent column apart", () => {
    const { loadings } = principalComponents(exact);
    const [b, c, o] = loadings[0];
    near(Math.abs(b), Math.abs(c), 1e-9);
    near(o, 0, 1e-9);
  });

  it("returns shares that sum to one", () => {
    const { variance } = principalComponents(exact);
    near(
      variance.reduce((a, b) => a + b, 0),
      1,
      1e-9,
    );
  });

  it("gives a constant column no variance and no loading", () => {
    const withDead: AuditMatrix = {
      keys: ["x", "dead"],
      names: ["A", "B", "C"],
      values: [
        [1, 7],
        [2, 7],
        [3, 7],
      ],
    };
    const { variance, loadings } = principalComponents(withDead);
    near(variance[0], 1, 1e-9);
    near(loadings[0][1], 0, 1e-9);
  });
});

describe("componentsToReach", () => {
  it("counts how many components clear the share", () => {
    assert.equal(componentsToReach([0.6, 0.2, 0.15, 0.05], 0.9), 3);
  });

  it("returns 1 when the first component already clears it", () => {
    assert.equal(componentsToReach([0.95, 0.05], 0.9), 1);
  });

  it("never claims more components than exist", () => {
    assert.equal(componentsToReach([0.5, 0.4], 0.99), 2);
  });
});

describe("weightedScores and orderOf", () => {
  const m: AuditMatrix = {
    keys: ["heavy", "light"],
    names: ["A", "B"],
    values: [
      [90, 60],
      [60, 90],
    ],
  };

  it("divides by the weights actually used, not by the column count", () => {
    const [a] = weightedScores(m, { heavy: 3, light: 1 });
    near(a.score, (90 * 3 + 60 * 1) / 4);
  });

  it("lets a weight decide the order", () => {
    assert.deepEqual(orderOf(weightedScores(m, { heavy: 3, light: 1 })), ["A", "B"]);
    assert.deepEqual(orderOf(weightedScores(m, { heavy: 1, light: 3 })), ["B", "A"]);
  });

  it("breaks a tie by name rather than by row order", () => {
    const tied: AuditMatrix = {
      keys: ["x"],
      names: ["Zoe", "Abe"],
      values: [[70], [70]],
    };
    assert.deepEqual(orderOf(weightedScores(tied, { x: 1 })), ["Abe", "Zoe"]);
  });
});

describe("weightSensitivity", () => {
  it("reports weights as inert when every attribute agrees", () => {
    // Three columns that rank everyone the same way. No weighting can change
    // the board, which is the case the football sheet turned out to be in.
    const agreeing: AuditMatrix = {
      keys: ["a", "b", "c"],
      names: ["A", "B", "C", "D"],
      values: [
        [90, 88, 92],
        [80, 78, 82],
        [70, 68, 72],
        [60, 58, 62],
      ],
    };
    const out = weightSensitivity(agreeing, { a: 1.2, b: 0.9, c: 1.05 }, {
      rng: rng(1),
      trials: 200,
    });
    assert.equal(out.flatOrderIdentical, true);
    near(out.flatCorrelation!, 1, 1e-6);
    for (const p of out.pairs) assert.equal(p.reversed, 0);
  });

  it("catches an adjacent pair the sheet cannot hold apart", () => {
    // B and C are separated by a hair on attributes that disagree, so a small
    // weight jitter reverses them. A and D are safe at either end.
    const knotted: AuditMatrix = {
      keys: ["a", "b"],
      names: ["A", "B", "C", "D"],
      values: [
        [99, 99],
        [80, 70],
        [70, 80],
        [60, 60],
      ],
    };
    const out = weightSensitivity(knotted, { a: 1, b: 1 }, {
      rng: rng(7),
      trials: 400,
      amount: 0.35,
    });
    const middle = out.pairs.find((p) => p.a === "B" && p.b === "C");
    assert.ok(middle, "B and C should be adjacent");
    assert.ok(middle!.reversed > 0.2, `expected an unstable pair, got ${middle!.reversed}`);
    assert.equal(out.pairs.find((p) => p.a === "A")!.reversed, 0);
  });

  it("is deterministic for a given seed", () => {
    const m: AuditMatrix = {
      keys: ["a", "b"],
      names: ["A", "B", "C"],
      values: [
        [90, 70],
        [80, 81],
        [70, 90],
      ],
    };
    const run = () =>
      weightSensitivity(m, { a: 1.1, b: 1 }, { rng: rng(42), trials: 100 }).pairs;
    assert.deepEqual(run(), run());
  });

  it("reports the largest points-of-rating gap the weights create", () => {
    const m: AuditMatrix = {
      keys: ["heavy", "light"],
      names: ["A", "B"],
      values: [
        [90, 60],
        [60, 90],
      ],
    };
    const out = weightSensitivity(m, { heavy: 3, light: 1 }, { rng: rng(3), trials: 50 });
    // Weighted puts A at 82.5, flat puts A at 75.
    near(out.flatMaxDelta, 7.5, 1e-9);
  });
});

describe("buildMatrix", () => {
  it("keeps roster order and column order", () => {
    const m = buildMatrix(["x", "y"], [
      { name: "A", ratings: { x: 1, y: 2 } },
      { name: "B", ratings: { x: 3, y: 4 } },
    ]);
    assert.deepEqual(m.names, ["A", "B"]);
    assert.deepEqual(m.values, [[1, 2], [3, 4]]);
  });

  it("fills a missing attribute with zero rather than undefined", () => {
    const m = buildMatrix(["x", "missing"], [{ name: "A", ratings: { x: 1 } }]);
    assert.deepEqual(m.values, [[1, 0]]);
  });

  it("throws on an attribute that is not in the matrix", () => {
    assert.throws(() => column(exact, "nope"), /no such attribute/);
  });
});
