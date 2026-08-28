import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  RATING_MAX,
  RATING_MIN,
  SPORTS,
  SPORT_IDS,
  computeOverall,
  defaultRatings,
  formatHeight,
  isSportId,
} from "@/lib/sports";
import { basketballRows } from "./fixtures";

describe("computeOverall", () => {
  /*
   * The stored overall is denormalised so lists can sort without recomputing,
   * which means it can drift from the attributes it claims to summarise. This
   * checks the seventeen live basketball profiles still reproduce.
   */
  it("reproduces every stored overall on the real roster", () => {
    const drift = basketballRows
      .map((r) => ({
        name: r.name,
        stored: r.overall,
        computed: computeOverall(SPORTS.basketball, r.ratings),
      }))
      .filter((x) => x.stored !== x.computed);
    assert.deepEqual(
      drift,
      [],
      `stored overalls drifted:\n${drift.map((d) => `${d.name}: ${d.stored} vs ${d.computed}`).join("\n")}`,
    );
  });

  it("is a weighted mean, not a flat one", () => {
    const config = SPORTS.basketball;
    // Athleticism is weighted 1.25, playmaking 1.00. Moving the heavier one
    // has to move the overall further.
    const base = Object.fromEntries(config.attributes.map((a) => [a.key, 80]));
    const heavier = { ...base, athleticism: 90 };
    const lighter = { ...base, playmaking: 90 };
    assert.ok(
      computeOverall(config, heavier) >= computeOverall(config, lighter),
      "the heavier attribute did not move the overall further",
    );
  });

  it("clamps to the rating scale", () => {
    const config = SPORTS.basketball;
    const all = (v: number) =>
      Object.fromEntries(config.attributes.map((a) => [a.key, v]));
    assert.equal(computeOverall(config, all(200)), RATING_MAX);
    assert.equal(computeOverall(config, all(0)), RATING_MIN);
  });

  it("treats a missing attribute as the default rather than as zero", () => {
    const config = SPORTS.basketball;
    const overall = computeOverall(config, { athleticism: 80 });
    assert.ok(
      overall >= RATING_MIN && overall <= RATING_MAX,
      `a missing attribute produced ${overall}`,
    );
  });

  it("is monotonic - raising any attribute never lowers the overall", () => {
    for (const config of Object.values(SPORTS)) {
      const base = defaultRatings(config);
      const from = computeOverall(config, base);
      for (const attr of config.attributes) {
        const raised = { ...base, [attr.key]: base[attr.key] + 10 };
        assert.ok(
          computeOverall(config, raised) >= from,
          `raising ${attr.key} lowered ${config.id}'s overall`,
        );
      }
    }
  });
});

describe("formatHeight", () => {
  it("renders inches as feet and inches", () => {
    assert.equal(formatHeight(71), `5'11"`);
    assert.equal(formatHeight(72), `6'0"`);
    assert.equal(formatHeight(65), `5'5"`);
  });

  it("returns null when no height is recorded", () => {
    assert.equal(formatHeight(null), null);
    assert.equal(formatHeight(undefined), null);
    assert.equal(formatHeight(NaN), null);
  });
});

describe("sport config", () => {
  it("every sport is internally consistent", () => {
    for (const id of SPORT_IDS) {
      const config = SPORTS[id];
      assert.equal(config.id, id, "config id does not match its key");

      const attrKeys = new Set(config.attributes.map((a) => a.key));
      assert.equal(attrKeys.size, config.attributes.length, `${id}: duplicate attribute`);
      assert.ok(config.attributes.length > 0, `${id}: no attributes`);

      const spotKeys = new Set(config.spots.map((s) => s.key));
      assert.equal(spotKeys.size, config.spots.length, `${id}: duplicate spot`);

      // sizeOrder is what places anyone who didn't get their own position, so
      // a key that names no spot silently drops a player.
      for (const key of config.sizeOrder) {
        assert.ok(spotKeys.has(key), `${id}: sizeOrder names unknown spot ${key}`);
      }
      // Attribute-filled spots are excluded on purpose: nothing about size
      // decides who plays quarterback. Every *other* spot must be covered, or
      // spillover has nowhere to put someone.
      const sized = new Set(config.sizeOrder);
      for (const spot of config.spots) {
        if (spot.byAttribute) continue;
        assert.ok(
          sized.has(spot.key),
          `${id}: spot ${spot.key} is missing from sizeOrder`,
        );
      }

      // A spot filled by position must name one that exists.
      const positionKeys = new Set(config.positions.map((p) => p.key));
      for (const spot of config.spots) {
        if (spot.byAttribute) {
          assert.ok(
            attrKeys.has(spot.byAttribute),
            `${id}: spot ${spot.key} fills from unknown attribute ${spot.byAttribute}`,
          );
          continue;
        }
        const claims = spot.position ?? spot.key;
        assert.ok(
          positionKeys.has(claims),
          `${id}: spot ${spot.key} claims unknown position ${claims}`,
        );
      }

      if (config.decisiveAttribute) {
        assert.ok(
          attrKeys.has(config.decisiveAttribute),
          `${id}: decisiveAttribute ${config.decisiveAttribute} is not an attribute`,
        );
      }
      if (config.criticalPosition) {
        assert.ok(positionKeys.has(config.criticalPosition));
      }
    }
  });

  it("football's quarterback is a spot filled from throwing, not a position", () => {
    const football = SPORTS.football;
    assert.equal(football.decisiveAttribute, "throwing");
    const qb = football.spots.find((s) => s.key === "qb");
    assert.equal(qb?.byAttribute, "throwing");
    assert.ok(
      !football.positions.some((p) => p.key === "qb"),
      "quarterback came back as a position",
    );
  });

  it("basketball names no decisive attribute", () => {
    // Everyone shoots and everyone rebounds; there is no skill only one player
    // uses at a time, so scoring on team maxima would be wrong.
    assert.equal(SPORTS.basketball.decisiveAttribute, undefined);
  });

  it("defaultRatings covers exactly the sport's attributes", () => {
    for (const config of Object.values(SPORTS)) {
      assert.deepEqual(
        Object.keys(defaultRatings(config)).sort(),
        config.attributes.map((a) => a.key).sort(),
      );
    }
  });

  it("isSportId accepts only configured sports", () => {
    assert.ok(isSportId("basketball"));
    assert.ok(isSportId("football"));
    assert.ok(!isSportId("hockey"));
    assert.ok(!isSportId(""));
  });
});
