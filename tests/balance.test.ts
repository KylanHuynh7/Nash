import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { balanceTeams } from "@/lib/balance";
import type { BalancePlayer } from "@/lib/balance";
import { SPORTS } from "@/lib/sports";
import { basketballPool, footballPool, byName } from "./fixtures";

const ids = (t: { players: BalancePlayer[] }) => t.players.map((p) => p.id);
const teamOf = (teams: { players: BalancePlayer[] }[], id: string) =>
  teams.findIndex((t) => t.players.some((p) => p.id === id));

describe("balanceTeams", () => {
  /*
   * The README's headline claim was "20 consecutive generations from the
   * seventeen-man pool all produced a spread of 0.0". Writing this test is what
   * showed that to be wrong: it is 0.1 for that pool, on every seed.
   *
   * 0.0 was never reachable there. Seventeen players split 8 and 9, and with
   * integer overalls two averages over different denominators almost never
   * coincide - the balancer was already at the arithmetic floor and the claim
   * was measuring something else. Asserting 0.0 would mean asserting a number
   * the code is not free to produce, so these assert the floor instead, plus
   * the thing actually worth claiming: how far it beats an unbalanced split.
   */
  it("lands within 0.2 of level on every pool size and seed", () => {
    const pool = basketballPool();
    const worst: string[] = [];
    for (const size of [10, 11, 12, 14, 16, 17]) {
      for (let seed = 1; seed <= 20; seed++) {
        const { spread } = balanceTeams(pool.slice(0, size), { teamCount: 2, seed });
        if (spread > 0.2) worst.push(`${size}p seed ${seed}: ${spread}`);
      }
    }
    assert.deepEqual(worst, [], `splits above 0.2:\n${worst.join("\n")}`);
  });

  it("hits a dead-level split when the arithmetic allows one", () => {
    // Fourteen players totalling 1142 can be halved exactly: 571 a side.
    // Where a zero exists the balancer has to find it, every time.
    const pool = basketballPool().slice(0, 14);
    const total = pool.reduce((s, p) => s + p.overall, 0);
    assert.equal(total % 2, 0, "fixture changed: this pool is no longer halvable");
    for (let seed = 1; seed <= 20; seed++) {
      assert.equal(
        balanceTeams(pool, { teamCount: 2, seed }).spread,
        0,
        `seed ${seed} missed an available zero`,
      );
    }
  });

  it("beats an unbalanced split by more than an order of magnitude", () => {
    // The claim worth making. A shuffled split of this roster is 2.5-2.7 apart
    // at the median and can reach 13; the balancer stays at or under 0.2.
    const pool = basketballPool();
    for (const size of [10, 12, 17]) {
      const sub = pool.slice(0, size);
      const randomSpreads = Array.from({ length: 200 }, (_, i) => {
        const shuffled = [...sub];
        let a = (i + 1) >>> 0;
        const rnd = () => {
          a = (a + 0x6d2b79f5) >>> 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        for (let k = shuffled.length - 1; k > 0; k--) {
          const j = Math.floor(rnd() * (k + 1));
          [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]];
        }
        const half = Math.ceil(shuffled.length / 2);
        const avg = (xs: typeof shuffled) =>
          xs.reduce((s, p) => s + p.overall, 0) / xs.length;
        return Math.abs(avg(shuffled.slice(0, half)) - avg(shuffled.slice(half)));
      }).sort((x, y) => x - y);

      const median = randomSpreads[100];
      const balanced = Math.max(
        ...Array.from({ length: 20 }, (_, i) =>
          balanceTeams(sub, { teamCount: 2, seed: i + 1 }).spread,
        ),
      );
      assert.ok(
        balanced * 10 < median,
        `${size}p: balancer worst ${balanced} vs random median ${median.toFixed(2)}`,
      );
    }
  });

  it("keeps the spread tight for three- and four-way splits too", () => {
    // Looser than the two-team bound on purpose: more teams means smaller
    // rosters, and a single point of overall moves a four-man average further.
    const pool = basketballPool();
    for (const teamCount of [3, 4]) {
      for (const size of [10, 11, 12, 15, 17]) {
        const { spread } = balanceTeams(pool.slice(0, size), {
          teamCount,
          seed: size * 7 + teamCount,
        });
        assert.ok(
          spread <= 2.0,
          `${size} players into ${teamCount} teams gave spread ${spread}`,
        );
      }
    }
  });

  it("places every player exactly once", () => {
    const pool = basketballPool();
    const { teams } = balanceTeams(pool, { teamCount: 3, seed: 5 });
    const placed = teams.flatMap(ids).sort();
    assert.equal(placed.length, pool.length);
    assert.deepEqual(placed, pool.map((p) => p.id).sort());
  });

  it("divides the roster as evenly as the count allows", () => {
    const pool = basketballPool();
    const { teams } = balanceTeams(pool, { teamCount: 2, seed: 3 });
    const sizes = teams.map((t) => t.players.length).sort();
    // Seventeen into two is 8 and 9. Nothing else is acceptable.
    assert.deepEqual(sizes, [8, 9]);
  });

  it("is deterministic for a given seed and varies across seeds", () => {
    const pool = basketballPool();
    const a = balanceTeams(pool, { teamCount: 2, seed: 42 });
    const b = balanceTeams(pool, { teamCount: 2, seed: 42 });
    assert.deepEqual(a.teams.map(ids), b.teams.map(ids));

    // Not a correctness requirement so much as a usability one: regenerating
    // has to be able to produce a different valid split.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      seen.add(JSON.stringify(balanceTeams(pool, { teamCount: 2, seed }).teams.map(ids)));
    }
    assert.ok(seen.size > 1, "every seed produced an identical split");
  });

  describe("constraints", () => {
    it("keeps a 'together' pair on the same team", () => {
      const pool = basketballPool();
      // Deliberately awkward: the best and the worst player, which the
      // strength term would otherwise pull apart.
      const together = [{ a: "taha", b: "justin" }];
      for (let seed = 1; seed <= 8; seed++) {
        const { teams } = balanceTeams(pool, { teamCount: 2, seed, together });
        assert.equal(
          teamOf(teams, "taha"),
          teamOf(teams, "justin"),
          `seed ${seed} split a together-pair`,
        );
      }
    });

    it("keeps an 'apart' pair on opposite teams and reports nothing unmet", () => {
      const pool = basketballPool();
      const apart = [{ a: "taha", b: "brendan" }];
      for (let seed = 1; seed <= 8; seed++) {
        const { teams, unmet } = balanceTeams(pool, { teamCount: 2, seed, apart });
        assert.notEqual(teamOf(teams, "taha"), teamOf(teams, "brendan"));
        assert.deepEqual(unmet, []);
      }
    });

    it("honours several together-pairs at once", () => {
      const pool = basketballPool();
      const together = [
        { a: "taha", b: "justin" },
        { a: "brendan", b: "alfonso" },
      ];
      const { teams } = balanceTeams(pool, { teamCount: 2, seed: 9, together });
      assert.equal(teamOf(teams, "taha"), teamOf(teams, "justin"));
      assert.equal(teamOf(teams, "brendan"), teamOf(teams, "alfonso"));
    });

    it("reports an impossible apart-constraint rather than silently dropping it", () => {
      // Three players who must all be on different teams, but only two teams.
      const pool = basketballPool().slice(0, 6);
      const apart = [
        { a: "taha", b: "brendan" },
        { a: "brendan", b: "orion" },
        { a: "taha", b: "orion" },
      ];
      const { unmet } = balanceTeams(pool, { teamCount: 2, seed: 4, apart });
      assert.equal(unmet.length, 1, "exactly one of the three has to give");
    });

    it("ignores constraints naming someone who isn't in the pool", () => {
      const pool = basketballPool().slice(0, 8);
      const result = balanceTeams(pool, {
        teamCount: 2,
        seed: 2,
        together: [{ a: "taha", b: "nobody" }],
        apart: [{ a: "ghost", b: "phantom" }],
      });
      assert.equal(result.teams.flatMap(ids).length, 8);
      assert.deepEqual(result.unmet, []);
    });
  });

  describe("decisiveAttribute", () => {
    /*
     * Football's throwing is scored on each team's best, not its average,
     * because only one person throws. The measured claim: with three real arms
     * in the pool the best-arm gap is 4 every time with the term, and 4 or 8
     * without it - 8 being both good arms stacked on one side.
     */
    const withArms = (): BalancePlayer[] => {
      const pool = footballPool();
      const arm = (name: string, value: number) => {
        byName(pool, name).ratings!.throwing = value;
      };
      arm("Orion", 92);
      arm("Danny", 88);
      arm("Jason", 84);
      return pool;
    };

    const bestArmGap = (teams: { players: BalancePlayer[] }[]) => {
      const bests = teams
        .filter((t) => t.players.length > 0)
        .map((t) => Math.max(...t.players.map((p) => p.ratings?.throwing ?? 0)));
      return Math.max(...bests) - Math.min(...bests);
    };

    it("keeps the best arm comparable across teams", () => {
      const pool = withArms();
      for (let seed = 1; seed <= 8; seed++) {
        const { teams } = balanceTeams(pool, {
          teamCount: 2,
          seed,
          sport: SPORTS.football,
        });
        assert.equal(
          bestArmGap(teams),
          4,
          `seed ${seed} stacked the arms: gap ${bestArmGap(teams)}`,
        );
      }
    });

    it("is what prevents the stack - without the sport config the gap can double", () => {
      const pool = withArms();
      const gaps = new Set<number>();
      for (let seed = 1; seed <= 8; seed++) {
        // No `sport`, so no decisive term.
        const { teams } = balanceTeams(pool, { teamCount: 2, seed });
        gaps.add(bestArmGap(teams));
      }
      assert.ok(
        gaps.has(8),
        `expected an unguarded split to stack both arms at least once, saw gaps ${[...gaps].join(", ")}`,
      );
    });

    it("does nothing when the attribute is uniform, as throwing is today", () => {
      // Every football profile has throwing 75, so the term is information-free
      // and must not perturb an otherwise good split.
      const pool = footballPool();
      const { spread } = balanceTeams(pool, {
        teamCount: 2,
        seed: 1,
        sport: SPORTS.football,
      });
      assert.ok(spread <= 1.0, `uniform throwing perturbed the split: ${spread}`);
    });
  });

  describe("edges", () => {
    it("returns empty teams for an empty pool", () => {
      const { teams, spread, unmet } = balanceTeams([], { teamCount: 2 });
      assert.equal(teams.length, 2);
      assert.deepEqual(teams.flatMap(ids), []);
      assert.equal(spread, 0);
      assert.deepEqual(unmet, []);
    });

    it("never makes fewer than two teams", () => {
      const pool = basketballPool().slice(0, 4);
      assert.equal(balanceTeams(pool, { teamCount: 1 }).teams.length, 2);
      assert.equal(balanceTeams(pool, { teamCount: 0 }).teams.length, 2);
    });

    it("handles a pool smaller than the team count", () => {
      const pool = basketballPool().slice(0, 2);
      const { teams } = balanceTeams(pool, { teamCount: 4, seed: 1 });
      assert.equal(teams.flatMap(ids).length, 2);
    });

    it("sorts each team strongest first", () => {
      const { teams } = balanceTeams(basketballPool(), { teamCount: 2, seed: 6 });
      for (const team of teams) {
        const overalls = team.players.map((p) => p.overall);
        assert.deepEqual(overalls, [...overalls].sort((a, b) => b - a));
      }
    });

    it("reports an average consistent with its own roster", () => {
      const { teams } = balanceTeams(basketballPool(), { teamCount: 3, seed: 8 });
      for (const team of teams) {
        const total = team.players.reduce((s, p) => s + p.overall, 0);
        assert.equal(team.total, total);
        assert.equal(team.average, Math.round((total / team.players.length) * 10) / 10);
      }
    });
  });
});
