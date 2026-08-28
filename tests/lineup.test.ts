import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { buildMatchups } from "@/lib/lineup";
import type { BalancePlayer } from "@/lib/balance";
import { SPORTS } from "@/lib/sports";
import { footballPool, byName } from "./fixtures";

const bball = SPORTS.basketball;
const fball = SPORTS.football;

/** Where one team's player ended up, by spot key. */
function placement(
  matchups: ReturnType<typeof buildMatchups>,
  team = 0,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of matchups) {
    const p = m.players[team];
    if (p) out[m.position] = p.name;
  }
  return out;
}

const player = (
  name: string,
  position: string,
  heightInches: number,
  extra: Partial<BalancePlayer> = {},
): BalancePlayer => ({
  id: name.toLowerCase(),
  name,
  overall: 80,
  position,
  heightInches,
  ...extra,
});

describe("buildMatchups", () => {
  it("places everyone at their stated position when the positions fit", () => {
    const team = [
      player("Point", "pg", 70),
      player("Shoot", "sg", 71),
      player("Small", "sf", 73),
      player("Power", "pf", 76),
      player("Centre", "c", 78),
    ];
    const at = placement(buildMatchups(bball, [team]));
    assert.deepEqual(at, {
      pg: "Point",
      sg: "Shoot",
      sf: "Small",
      pf: "Power",
      c: "Centre",
    });
  });

  it("never loses a player, even when every position collides", () => {
    const team = Array.from({ length: 5 }, (_, i) =>
      player(`Guard${i}`, "pg", 68 + i),
    );
    const matchups = buildMatchups(bball, [team]);
    const placed = matchups.map((m) => m.players[0]).filter(Boolean);
    assert.equal(placed.length, 5);
    assert.equal(new Set(placed.map((p) => p!.id)).size, 5);
  });

  /*
   * The bug this guards: settleByHeight used to run over everyone, so a stated
   * point guard who happened to be the tallest man on his team was dragged to
   * power forward on every single render. Only players the code itself placed
   * are up for settling.
   */
  it("leaves a player standing at his own stated position alone", () => {
    const team = [
      player("TallPG", "pg", 78), // tallest, but he asked for the point
      player("ShortC", "c", 66),
      player("Wing", "sf", 72),
    ];
    const at = placement(buildMatchups(bball, [team]));
    assert.equal(at.pg, "TallPG", "a stated position was overridden by height");
    assert.equal(at.c, "ShortC", "a stated position was overridden by height");
  });

  it("settles spillover players by height", () => {
    // Four centres: one gets the c spot, the rest are placed by us and so are
    // fair game. The tallest spare should not end up at the smallest spot.
    const team = [
      player("Big", "c", 80),
      player("Tall", "c", 78),
      player("Mid", "c", 72),
      player("Short", "c", 68),
      player("Small", "c", 66),
    ];
    const at = placement(buildMatchups(bball, [team]));
    const heightAt = (spot: string) =>
      team.find((p) => p.name === at[spot])!.heightInches!;
    assert.ok(
      heightAt("c") >= heightAt("pg"),
      `centre (${heightAt("c")}") shorter than point guard (${heightAt("pg")}")`,
    );
  });

  it("tolerates a near-match rather than churning the board", () => {
    // Two spillovers within the 3" tolerance must not be swapped.
    const team = [
      player("A", "c", 72),
      player("B", "c", 74), // 2" taller, inside tolerance
    ];
    const first = placement(buildMatchups(bball, [team]));
    const second = placement(buildMatchups(bball, [team]));
    assert.deepEqual(first, second, "placement is not stable");
  });

  describe("pins", () => {
    it("puts a pinned player exactly where he was dropped", () => {
      const team = [
        player("Point", "pg", 70),
        player("Centre", "c", 78),
        player("Wing", "sf", 73),
      ];
      const at = placement(buildMatchups(bball, [team], { centre: "pg" }));
      assert.equal(at.pg, "Centre", "a pin was not honoured");
    });

    it("does not rewrite the player's position when pinning", () => {
      // The bug: a drop wrote the spot key into `position`, and saveRun
      // snapshots it - so a saved run rendered the raw key forever.
      const team = [player("Centre", "c", 78), player("Point", "pg", 70)];
      buildMatchups(bball, [team], { centre: "pg" });
      assert.equal(team[0].position, "c", "buildMatchups mutated a position");
    });

    it("a pinned player is exempt from height settling", () => {
      const team = [
        player("Shortest", "sg", 64),
        player("Tallest", "c", 80),
        player("Middle", "sf", 72),
      ];
      // Deliberately perverse: the shortest man pinned to centre.
      const at = placement(buildMatchups(bball, [team], { shortest: "c" }));
      assert.equal(at.c, "Shortest", "settling overrode a hand placement");
    });
  });

  describe("football", () => {
    /** A named subset, so a test reads as people rather than slice indexes. */
    const squad = (...names: string[]) => {
      const pool = footballPool();
      return names.map((n) => byName(pool, n));
    };

    it("fills the quarterback spot from throwing, not from a position", () => {
      const team = squad("Orion", "Victor", "Joe", "Kylan", "Rayan");
      byName(team, "Rayan").ratings!.throwing = 95; // the arm, but a WR
      const matchups = buildMatchups(fball, [team]);
      const qb = matchups.find((m) => m.position === "qb");
      assert.ok(qb, "football has no qb spot");
      assert.equal(
        qb!.players[0]?.name,
        "Rayan",
        "the quarterback spot did not go to the best arm",
      );
    });

    it("nobody is labelled quarterback - it is a spot, not a position", () => {
      const positions = new Set(footballPool().map((p) => p.position));
      assert.ok(!positions.has("qb"), "someone is stored as a qb");
      const spot = fball.spots.find((s) => s.key === "qb");
      assert.equal(spot?.byAttribute, "throwing");
    });

    it("resolves the arm before position matching, not after", () => {
      // If position matching ran first the best arm would already be out wide.
      const team = squad("Orion", "Victor", "Kylan", "Lucas", "Brian");
      byName(team, "Brian").ratings!.throwing = 99;
      const matchups = buildMatchups(fball, [team]);
      const qb = matchups.find((m) => m.position === "qb");
      assert.equal(qb!.players[0]?.name, "Brian");
    });

    it("gives three receivers three different spots", () => {
      // Every WR used to fall through to spillover and get placed by height,
      // because no football position matched any field spot.
      const team = squad("Orion", "Victor", "Lucas");
      assert.ok(team.every((p) => p.position === "wr"));
      const matchups = buildMatchups(fball, [team]);
      const spots = matchups
        .filter((m) => m.players[0])
        .map((m) => m.position);
      assert.equal(new Set(spots).size, spots.length, "two players share a spot");
      assert.ok(spots.length >= 3, "receivers were dropped");
    });
  });

  /*
   * Regression. The quarterback spot is filled from an attribute and so is
   * absent from sizeOrder, which is correct - size has nothing to do with who
   * throws. But when no player carried a throwing rating the spot went unfilled
   * *and* was excluded from spillover, so a five-man side had four places for
   * five people and quietly lost one off the field.
   *
   * The state that triggers it is not exotic: it is any group that has not
   * rated attributes yet, which in the public version is every group on day
   * one, since overalls come from pairwise comparison and attributes are
   * optional.
   */
  it("places everyone even when no player has any attribute ratings", () => {
    for (const config of [bball, fball]) {
      for (const size of [3, 4, 5]) {
        const team = Array.from({ length: size }, (_, i) => ({
          ...player(`P${i}`, config.positions[i % config.positions.length].key, 70 + i),
          ratings: undefined,
        }));
        const matchups = buildMatchups(config, [team]);
        const placed = matchups.map((m) => m.players[0]).filter(Boolean);
        assert.equal(
          placed.length,
          size,
          `${config.id}: ${size - placed.length} of ${size} players fell off the field`,
        );
      }
    }
  });

  it("never loses a player, across both sports and every team size", () => {
    for (const config of [bball, fball]) {
      const spots = config.spots.length;
      for (let size = 1; size <= spots; size++) {
        for (const pos of config.positions) {
          // Worst case: everyone wants the same position.
          const team = Array.from({ length: size }, (_, i) =>
            player(`${pos.key}${i}`, pos.key, 66 + i, {
              ratings: { throwing: 70 + i },
            }),
          );
          const placed = buildMatchups(config, [team])
            .map((m) => m.players[0])
            .filter(Boolean);
          assert.equal(
            placed.length,
            size,
            `${config.id}: ${size} players all at ${pos.key} lost ${size - placed.length}`,
          );
        }
      }
    }
  });

  it("lays out both teams independently", () => {
    const a = [player("A1", "pg", 70), player("A2", "c", 78)];
    const b = [player("B1", "pg", 71)];
    const matchups = buildMatchups(bball, [a, b]);
    const pg = matchups.find((m) => m.position === "pg")!;
    assert.equal(pg.players[0]?.name, "A1");
    assert.equal(pg.players[1]?.name, "B1");
    const c = matchups.find((m) => m.position === "c")!;
    assert.equal(c.players[0]?.name, "A2");
    assert.equal(c.players[1], null, "team two invented a player");
  });

  it("returns one matchup per configured spot, in config order", () => {
    for (const config of [bball, fball]) {
      const matchups = buildMatchups(config, [[]]);
      assert.deepEqual(
        matchups.map((m) => m.position),
        config.spots.map((s) => s.key),
      );
    }
  });
});
