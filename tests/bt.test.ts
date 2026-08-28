import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  POINTS_PER_UNIT,
  agreementWithConsensus,
  agreementWithCurrent,
  dropSelfComparisons,
  dropTies,
  excludeRaters,
  fitBradleyTerry,
} from "@/lib/bt";
import type { BtComparison, BtPlayer } from "@/lib/bt";

/*
 * Everything here is synthetic. The fit is the one place an opinion becomes a
 * number, so it needs testing against data whose right answer is known - which
 * real comparisons never are. No test in this file opens a database.
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

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** A roster whose stored overalls are deliberately flat, so only data moves it. */
function roster(count: number, overall = 80): BtPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    overall,
  }));
}

/**
 * Comparisons drawn from a known set of true strengths.
 *
 * `bias` shifts one rater's view of a named player, which is how a rater who
 * over-rates his friend is simulated.
 */
function simulate(
  people: BtPlayer[],
  truth: number[],
  options: {
    rounds?: number;
    seed?: number;
    raters?: string[];
    bias?: Record<string, Record<string, number>>;
  } = {},
): BtComparison[] {
  const { rounds = 6, seed = 1, raters = ["r1"], bias = {} } = options;
  const rand = rng(seed);
  const rows: BtComparison[] = [];
  for (const raterId of raters) {
    const view = bias[raterId] ?? {};
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < people.length; i++) {
        for (let j = i + 1; j < people.length; j++) {
          const si = truth[i] + (view[people[i].id] ?? 0);
          const sj = truth[j] + (view[people[j].id] ?? 0);
          const iWins = rand() < sigmoid(si - sj);
          rows.push({
            raterId,
            leftId: people[i].id,
            rightId: people[j].id,
            winnerId: iWins ? people[i].id : people[j].id,
          });
        }
      }
    }
  }
  return rows;
}

/** Ranking by fitted strength, strongest first. */
function order(people: BtPlayer[], strengths: number[]): string[] {
  return people
    .map((p, i) => ({ id: p.id, s: strengths[i] }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.id);
}

describe("fitBradleyTerry", () => {
  it("recovers a known ranking from clean data", () => {
    const people = roster(6);
    const truth = [2.4, 1.5, 0.6, -0.3, -1.2, -2.1];
    const rows = simulate(people, truth, { rounds: 40, seed: 7 });
    const fit = fitBradleyTerry(people, rows, { lambda: 0.01 });
    assert.deepEqual(
      order(people, fit.strengths),
      people.map((p) => p.id),
      "the fitted ranking does not match the true one",
    );
  });

  it("recovers the size of the gaps, not just their order", () => {
    const people = roster(5);
    const truth = [2.0, 1.0, 0.0, -1.0, -2.0];
    const rows = simulate(people, truth, { rounds: 150, seed: 11 });
    const fit = fitBradleyTerry(people, rows, { lambda: 0.01 });
    // Latent strengths are only identified up to a shift, and the fit centres
    // them, so compare against the centred truth.
    const mean = truth.reduce((a, b) => a + b, 0) / truth.length;
    truth.forEach((t, i) => {
      assert.ok(
        Math.abs(fit.strengths[i] - (t - mean)) < 0.15,
        `${people[i].name}: fitted ${fit.strengths[i].toFixed(2)} vs true ${(t - mean).toFixed(2)}`,
      );
    });
  });

  it("finds the consensus despite a rater who over-rates his friend", () => {
    /*
     * The reason the collector stores `raterId` at all. One rater views P4 two
     * full latent units better than he is; three others see him straight. The
     * consensus should still land P4 in his true position.
     */
    const people = roster(6);
    const truth = [2.4, 1.5, 0.6, -0.3, -1.2, -2.1];
    const rows = simulate(people, truth, {
      rounds: 25,
      seed: 3,
      raters: ["honest1", "honest2", "honest3", "homer"],
      bias: { homer: { p4: 2.0 } },
    });
    const fit = fitBradleyTerry(people, rows, { lambda: 0.01 });
    const ranking = order(people, fit.strengths);
    assert.equal(ranking.indexOf("p4"), 4, `p4 landed at ${ranking.indexOf("p4")}`);
  });

  /*
   * The test that catches a diverging optimiser, and the one that found the
   * step-size bug: an estimator has to get *better* with more data. Under the
   * old fixed step the error went the other way - 0.41 at 600 comparisons,
   * 6.5 at 1,500, 37.0 at 4,000 - because the log-likelihood gradient is a sum
   * over observations, so its magnitude grew with the pile while the step
   * stayed put. Every individual fit still returned plausible-looking numbers.
   */
  it("gets more accurate as comparisons accumulate, not less", () => {
    const people = roster(5);
    const truth = [2, 1, 0, -1, -2];
    const errors = [60, 150, 400, 1000].map((rounds) => {
      const fit = fitBradleyTerry(
        people,
        simulate(people, truth, { rounds, seed: 11 }),
        { lambda: 0.01 },
      );
      return Math.max(...truth.map((t, i) => Math.abs(fit.strengths[i] - t)));
    });
    for (let i = 1; i < errors.length; i++) {
      assert.ok(
        errors[i] <= errors[i - 1] + 0.02,
        `error rose with more data: ${errors.map((e) => e.toFixed(3)).join(" -> ")}`,
      );
    }
    assert.ok(
      errors[errors.length - 1] < 0.1,
      `never converged: ${errors.map((e) => e.toFixed(3)).join(" -> ")}`,
    );
  });

  it("stays finite at any lambda, however extreme", () => {
    // --lambda is a CLI flag with no upper bound. It used to overflow to NaN
    // above 40, and NaN proposals print as blanks rather than as an error.
    const people = [
      { id: "a", name: "A", overall: 95 },
      { id: "b", name: "B", overall: 70 },
    ];
    const rows: BtComparison[] = Array.from({ length: 40 }, (_, i) => ({
      raterId: `r${i}`,
      leftId: "a",
      rightId: "b",
      winnerId: "b",
    }));
    for (const lambda of [0.001, 1, 10, 39, 40, 41, 100, 5000]) {
      const fit = fitBradleyTerry(people, rows, { lambda });
      assert.ok(
        fit.strengths.every(Number.isFinite),
        `lambda ${lambda} produced ${fit.strengths}`,
      );
      assert.ok(
        fit.proposed.every((v) => Number.isInteger(v) && v >= 65 && v <= 99),
        `lambda ${lambda} proposed ${fit.proposed}`,
      );
    }
  });

  it("shrinkage is monotone in lambda", () => {
    // Raising lambda must move players steadily back toward their priors,
    // never past them and never erratically.
    const people = [
      { id: "a", name: "A", overall: 95 },
      { id: "b", name: "B", overall: 70 },
    ];
    const rows: BtComparison[] = Array.from({ length: 40 }, (_, i) => ({
      raterId: `r${i}`,
      leftId: "a",
      rightId: "b",
      winnerId: "b",
    }));
    const gaps = [0.5, 1, 3, 10, 30, 100, 5000].map((lambda) => {
      const fit = fitBradleyTerry(people, rows, { lambda });
      return fit.unclamped[0] - fit.unclamped[1];
    });
    for (let i = 1; i < gaps.length; i++) {
      assert.ok(
        gaps[i] >= gaps[i - 1] - 1e-9,
        `lambda step ${i} went backwards: ${gaps.map((g) => g.toFixed(2)).join(", ")}`,
      );
    }
    // At the extreme the data is ignored entirely and the prior gap returns.
    assert.ok(Math.abs(gaps[gaps.length - 1] - 25) < 0.5, `${gaps[gaps.length - 1]}`);
  });

  it("is monotonic - winning more can only raise a strength", () => {
    const people = roster(3);
    const base: BtComparison[] = [
      { raterId: "r", leftId: "p0", rightId: "p1", winnerId: "p0" },
      { raterId: "r", leftId: "p1", rightId: "p2", winnerId: "p1" },
    ];
    const before = fitBradleyTerry(people, base, { lambda: 0.1 });
    const after = fitBradleyTerry(
      people,
      [...base, { raterId: "r2", leftId: "p2", rightId: "p0", winnerId: "p2" }],
      { lambda: 0.1 },
    );
    assert.ok(
      after.strengths[2] > before.strengths[2],
      "an extra win did not raise the winner's strength",
    );
  });

  describe("shrinkage", () => {
    it("leaves a player nobody was asked about at his prior", () => {
      // The whole reason the penalty exists: an unmentioned player must keep
      // his number rather than drifting to the middle of the scale.
      const people: BtPlayer[] = [
        { id: "a", name: "A", overall: 95 },
        { id: "b", name: "B", overall: 70 },
        { id: "ghost", name: "Ghost", overall: 88 },
      ];
      const rows: BtComparison[] = [
        { raterId: "r", leftId: "a", rightId: "b", winnerId: "a" },
      ];
      const fit = fitBradleyTerry(people, rows, { lambda: 1 });
      assert.equal(fit.appearances[2], 0);
      assert.equal(
        fit.proposed[2],
        88,
        `an unmentioned player moved to ${fit.proposed[2]}`,
      );
    });

    it("a high lambda holds players at their existing ratings", () => {
      const people = [
        { id: "a", name: "A", overall: 95 },
        { id: "b", name: "B", overall: 70 },
      ];
      // Data says B beats A, emphatically, every time.
      const rows: BtComparison[] = Array.from({ length: 40 }, (_, i) => ({
        raterId: `r${i}`,
        leftId: "a",
        rightId: "b",
        winnerId: "b",
      }));
      const stiff = fitBradleyTerry(people, rows, { lambda: 500 });
      assert.deepEqual([stiff.proposed[0], stiff.proposed[1]], [95, 70]);
      assert.ok(stiff.converged, "a heavy prior did not settle");
    });

    it("a low lambda lets the data overturn them", () => {
      const people = [
        { id: "a", name: "A", overall: 95 },
        { id: "b", name: "B", overall: 70 },
      ];
      const rows: BtComparison[] = Array.from({ length: 40 }, (_, i) => ({
        raterId: `r${i}`,
        leftId: "a",
        rightId: "b",
        winnerId: "b",
      }));
      const loose = fitBradleyTerry(people, rows, { lambda: 0.01 });
      assert.ok(
        loose.proposed[1] > loose.proposed[0],
        `B (${loose.proposed[1]}) did not overtake A (${loose.proposed[0]})`,
      );
    });

    it("moves a well-covered player further than a thin one at the same lambda", () => {
      /*
       * Per-player shrinkage falls out of the likelihood's curvature rather
       * than being coded: a player seen forty times is moved by the data, one
       * seen twice is barely moved. It is the property that makes a single
       * global lambda defensible.
       */
      const people = [
        { id: "a", name: "A", overall: 80 },
        { id: "covered", name: "Covered", overall: 80 },
        { id: "thin", name: "Thin", overall: 80 },
      ];
      const rows: BtComparison[] = [
        ...Array.from({ length: 40 }, (_, i) => ({
          raterId: `r${i}`,
          leftId: "covered",
          rightId: "a",
          winnerId: "covered",
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          raterId: `q${i}`,
          leftId: "thin",
          rightId: "a",
          winnerId: "thin",
        })),
      ];
      const fit = fitBradleyTerry(people, rows, { lambda: 1 });
      const covered = fit.strengths[1] - 0;
      const thin = fit.strengths[2] - 0;
      assert.ok(
        covered > thin,
        `covered moved ${covered.toFixed(2)}, thin moved ${thin.toFixed(2)}`,
      );
    });
  });

  describe("scale and output", () => {
    it("centres the latent strengths on zero", () => {
      const people = roster(6);
      const rows = simulate(people, [2, 1, 0.5, -0.5, -1, -2], { seed: 5 });
      const fit = fitBradleyTerry(people, rows, { lambda: 0.5 });
      const mean = fit.strengths.reduce((a, b) => a + b, 0) / fit.strengths.length;
      assert.ok(Math.abs(mean) < 1e-6, `strengths are off-centre by ${mean}`);
    });

    it("clamps proposals to the rating scale", () => {
      const people = [
        { id: "god", name: "God", overall: 99 },
        { id: "mortal", name: "Mortal", overall: 65 },
      ];
      const rows: BtComparison[] = Array.from({ length: 200 }, (_, i) => ({
        raterId: `r${i}`,
        leftId: "god",
        rightId: "mortal",
        winnerId: "god",
      }));
      const fit = fitBradleyTerry(people, rows, { lambda: 0.001 });
      assert.ok(fit.proposed.every((p) => p >= 65 && p <= 99), `${fit.proposed}`);
      // The unclamped figure keeps the overflow, so the script can report it.
      assert.ok(fit.unclamped[0] > 99 || fit.unclamped[1] < 65);
    });

    it("keeps the existing mean as the centre of the proposed scale", () => {
      const people = [
        { id: "a", name: "A", overall: 90 },
        { id: "b", name: "B", overall: 80 },
        { id: "c", name: "C", overall: 70 },
      ];
      const fit = fitBradleyTerry(people, [], { lambda: 1 });
      assert.equal(fit.meanOverall, 80);
      // With no data at all, everyone stays exactly where they were.
      assert.deepEqual(fit.proposed, [90, 80, 70]);
    });

    it("is deterministic", () => {
      const people = roster(6);
      const rows = simulate(people, [2, 1, 0.5, -0.5, -1, -2], { seed: 9 });
      const a = fitBradleyTerry(people, rows, { lambda: 1 });
      const b = fitBradleyTerry(people, rows, { lambda: 1 });
      assert.deepEqual(a.strengths, b.strengths);
      assert.deepEqual(a.proposed, b.proposed);
    });

    it("converges rather than running out of iterations", () => {
      const people = roster(8);
      const rows = simulate(people, [3, 2, 1, 0.5, -0.5, -1, -2, -3], { seed: 2 });
      const fit = fitBradleyTerry(people, rows, { lambda: 1 });
      assert.ok(fit.converged, `did not settle in ${fit.iterations} iterations`);
    });

    it("survives an empty roster and empty data", () => {
      assert.deepEqual(fitBradleyTerry([], []).proposed, []);
      const people = roster(3);
      const fit = fitBradleyTerry(people, []);
      assert.deepEqual(fit.appearances, [0, 0, 0]);
      assert.ok(fit.strengths.every((s) => Number.isFinite(s)));
    });

    it("ignores rows naming someone off the roster", () => {
      const people = roster(2);
      const rows: BtComparison[] = [
        { raterId: "r", leftId: "p0", rightId: "stranger", winnerId: "p0" },
      ];
      const fit = fitBradleyTerry(people, rows, { lambda: 1 });
      assert.deepEqual(fit.appearances, [0, 0]);
    });

    it("POINTS_PER_UNIT sets what a latent unit is worth in rating points", () => {
      const people = [
        { id: "a", name: "A", overall: 80 },
        { id: "b", name: "B", overall: 80 },
      ];
      const rows: BtComparison[] = Array.from({ length: 30 }, (_, i) => ({
        raterId: `r${i}`,
        leftId: "a",
        rightId: "b",
        winnerId: "a",
      }));
      const fit = fitBradleyTerry(people, rows, { lambda: 0.5 });
      const gapInPoints = fit.unclamped[0] - fit.unclamped[1];
      const gapInUnits = fit.strengths[0] - fit.strengths[1];
      assert.ok(
        Math.abs(gapInPoints - gapInUnits * POINTS_PER_UNIT) < 1e-9,
        "the latent scale is not being converted at POINTS_PER_UNIT",
      );
    });
  });
});

describe("filters", () => {
  const rows: BtComparison[] = [
    { raterId: "a", leftId: "a", rightId: "b", winnerId: "a" }, // self
    { raterId: "a", leftId: "b", rightId: "a", winnerId: "b" }, // self
    { raterId: "a", leftId: "b", rightId: "c", winnerId: "b" },
    { raterId: "b", leftId: "a", rightId: "c", winnerId: null }, // tie
    { raterId: "b", leftId: "a", rightId: "c", winnerId: "a" },
  ];

  it("drops every comparison a rater made about himself", () => {
    const kept = dropSelfComparisons(rows);
    assert.equal(kept.length, 3);
    assert.ok(
      kept.every((r) => r.raterId !== r.leftId && r.raterId !== r.rightId),
      "a self-comparison survived the filter",
    );
  });

  it("drops ties, because plain Bradley-Terry has no tie term", () => {
    assert.equal(dropTies(rows).length, 4);
    assert.ok(dropTies(rows).every((r) => r.winnerId !== null));
  });

  it("the fit ignores a tie even if one is handed to it directly", () => {
    // Belt and braces: the script filters, but the solver must not count a
    // null winner as a win for anybody.
    const people = roster(2);
    const fit = fitBradleyTerry(people, [
      { raterId: "r", leftId: "p0", rightId: "p1", winnerId: null },
    ]);
    assert.deepEqual(fit.appearances, [0, 0]);
  });

  it("excludes named raters", () => {
    const kept = excludeRaters(rows, new Set(["a"]));
    assert.equal(kept.length, 2);
    assert.ok(kept.every((r) => r.raterId === "b"));
  });

  it("excluding nobody keeps everything", () => {
    assert.equal(excludeRaters(rows, new Set()).length, rows.length);
  });
});

describe("agreement diagnostics", () => {
  const overallOf = new Map([
    ["a", 90],
    ["b", 80],
    ["c", 80], // deliberately tied with b
  ]);

  it("scores agreement with the stored ratings", () => {
    const rows: BtComparison[] = [
      { raterId: "r", leftId: "a", rightId: "b", winnerId: "a" }, // agrees
      { raterId: "r", leftId: "a", rightId: "b", winnerId: "b" }, // disagrees
    ];
    assert.equal(agreementWithCurrent(rows, overallOf), 0.5);
  });

  it("skips pairs the stored ratings cannot separate", () => {
    // b and c are both 80: the ratings express no preference, so the pair says
    // nothing about agreement either way and must not count as a miss.
    const rows: BtComparison[] = [
      { raterId: "r", leftId: "b", rightId: "c", winnerId: "b" },
      { raterId: "r", leftId: "a", rightId: "b", winnerId: "a" },
    ];
    assert.equal(agreementWithCurrent(rows, overallOf), 1);
  });

  it("returns NaN rather than 0 when there is nothing to score", () => {
    assert.ok(Number.isNaN(agreementWithCurrent([], overallOf)));
    assert.ok(Number.isNaN(agreementWithConsensus([], new Map())));
  });

  it("scores agreement with the fitted consensus", () => {
    const strengthOf = new Map([
      ["a", 1.0],
      ["b", 0.0],
    ]);
    const rows: BtComparison[] = [
      { raterId: "r", leftId: "a", rightId: "b", winnerId: "a" },
      { raterId: "r", leftId: "a", rightId: "b", winnerId: "a" },
      { raterId: "r", leftId: "a", rightId: "b", winnerId: "b" },
    ];
    assert.ok(Math.abs(agreementWithConsensus(rows, strengthOf) - 2 / 3) < 1e-9);
  });

  it("a rater who contradicts the ratings scores low against them", () => {
    // The shape of the finding the collection is looking for.
    const rows: BtComparison[] = [
      { raterId: "r", leftId: "a", rightId: "b", winnerId: "b" },
      { raterId: "r", leftId: "b", rightId: "a", winnerId: "b" },
    ];
    assert.equal(agreementWithCurrent(rows, overallOf), 0);
  });
});
