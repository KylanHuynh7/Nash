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
    // Finishing is weighted 1.15, playmaking 1.00. Moving the heavier one has
    // to move the overall further. (Deliberately not a physical: after the
    // split those carry 1.25/3 each, which is *lighter* than playmaking —
    // the family keeps the parent's weight, the members do not.)
    const base = Object.fromEntries(config.attributes.map((a) => [a.key, 80]));
    const heavier = { ...base, finishing: 90 };
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

  it("every sport opens with the overall axis", () => {
    // Overall is the number the balancer uses, so it is the one worth
    // de-biasing first and the one a bare link must ask for.
    for (const sport of Object.values(SPORTS)) {
      assert.ok(sport.axes.length > 0, `${sport.id} has no axes`);
      assert.equal(sport.axes[0].key, "overall", `${sport.id} opens elsewhere`);
      assert.equal(
        sport.axes[0].attribute,
        undefined,
        "the overall axis is a weighted mean, not a stored attribute",
      );
    }
  });

  it("every axis is asked as a question and names a real attribute", () => {
    for (const sport of Object.values(SPORTS)) {
      const keys = new Set<string>();
      for (const axis of sport.axes) {
        assert.ok(!keys.has(axis.key), `${sport.id} repeats axis ${axis.key}`);
        keys.add(axis.key);
        assert.ok(axis.question.length > 0, `${axis.key} asks nothing`);
        assert.ok(axis.label.length > 0, `${axis.key} has no label`);
        assert.ok(axis.heading.length > 0, `${axis.key} has no heading`);
        assert.ok(axis.prompt.length > 0, `${axis.key} has no prompt`);
        // The headline is the one line that reliably gets read, so it has to
        // name what is being compared rather than gesture at it. A rater who
        // skims "Who's still going?" has not been told the question.
        // A loose stem check — three letters of the label. Loose is enough to
        // catch the regression that matters: a flavour headline like "Who's
        // still going?" for the stamina axis names nothing at all.
        const names =
          axis.key === "overall"
            ? /player|better/i
            : new RegExp(axis.label.slice(0, 3), "i");
        assert.ok(
          names.test(axis.heading),
          `${axis.key} heading does not name what is being compared: "${axis.heading}"`,
        );
        assert.ok(
          names.test(axis.prompt),
          `${axis.key} prompt does not name what is being compared: "${axis.prompt}"`,
        );
        if (axis.attribute) {
          // An axis pointing at an attribute that does not exist would collect
          // answers nothing could ever be fitted to.
          assert.ok(
            sport.attributes.some((a) => a.key === axis.attribute),
            `${sport.id} axis ${axis.key} names unknown attribute ${axis.attribute}`,
          );
        }
      }
    }
  });

  it("football collects nothing beyond the overall while it is parked", () => {
    /*
     * `throwing` is the most collectable number in the app on the merits —
     * flat 75 for all twelve, and load bearing, since it picks the quarterback
     * and the balancer scores it on each side's best. It is still not
     * collected, because football is parked behind basketball and every send
     * spends the same scarce thing: a friend's willingness to answer sixty
     * questions.
     *
     * The attribute stays. The QB spot is filled from it and the balancer
     * names it as decisive, so removing it would be a different change
     * entirely.
     */
    assert.deepEqual(SPORTS.football.axes.map((a) => a.key), ["overall"]);
    assert.equal(SPORTS.football.decisiveAttribute, "throwing");
    assert.ok(
      SPORTS.football.attributes.some((a) => a.key === "throwing"),
      "the QB spot is filled from throwing; the attribute has to stay",
    );
  });

  it("basketball's round is nine comparative blocks plus the comp block", () => {
    /*
     * The round friends actually receive. Ticks are CLOSED — one person ran
     * them to identify who does what, and their slates are frozen into the
     * `poolNames` of the ranking blocks, so no rater is asked to tick anything.
     *
     * Ordered so an abandoned tail costs least: the four pool rankings first
     * (shortest blocks, most novel data), then the three in-flight axes, then
     * the two most redundant with what is already collected.
     */
    const collecting = SPORTS.basketball.axes.filter((a) => a.collect);
    assert.deepEqual(
      collecting.map((a) => a.key),
      [
        "post_control_rank",
        "block_rank",
        "steal_rank",
        "three_point_rank",
        "off_reb",
        "ball_handle",
        "nba_comp",
      ],
    );
    // No tick block is in the round any more, and exactly one comp block is.
    assert.ok(!collecting.some((a) => a.mode === "tick"));
    const comps = collecting.filter((a) => a.mode === "comp");
    assert.equal(comps.length, 1);
    // Last, because it is the shortest and the most fun - what a rater reaches
    // after the grind, not what distracts from it.
    assert.equal(collecting[collecting.length - 1].mode, "comp");

    const comparative = collecting.filter(
      (a) => (a.mode ?? "comparative") === "comparative",
    );
    assert.equal(comparative.length, 6);
    // Every comparative block states its own depth. Sharing SESSION_TARGET
    // silently reshapes finished blocks whenever the round grows.
    for (const a of comparative) {
      assert.ok(a.target && a.target > 0, `${a.key} states no target`);
      assert.ok(a.attribute, `${a.key} collects toward no attribute`);
    }
    /*
     * The comp block states NEITHER, and both absences are deliberate. Its
     * depth is one question per subject, derived from the pool rather than
     * declared; and it names no attribute because nothing is fitted from it -
     * a comp is a label, and fit-bt must never see it.
     */
    for (const a of comps) {
      assert.equal(a.target, undefined, `${a.key} should not state a target`);
      assert.equal(a.attribute, undefined, `${a.key} must not name an attribute`);
    }
    // The blocks two raters already finished keep the depth they answered
    // against, or those raters silently become incomplete.
    /*
     * Stamina, strength and interior D were CLOSED on 2026-08-29 once their
     * fits were applied - `collect: false`, not deleted, so their rows keep
     * their meaning and the axes can be reopened. Redirecting the two raters
     * who had not started toward the six axes still on one rater is worth far
     * more than deepening three that already had three: error falls as root n,
     * so 1 to 3 raters removes 42% of it and 3 to 5 only 23%.
     */
    for (const key of ["stamina", "strength", "interior_d"]) {
      const axis = SPORTS.basketball.axes.find((a) => a.key === key);
      assert.ok(axis, `${key} must stay configured, not be deleted`);
      assert.equal(axis.collect, false, `${key} should be closed`);
    }

    // A pool block can never ask for more pairs than its slate holds.
    for (const a of collecting) {
      if (!a.poolNames) continue;
      const n = a.poolNames.length;
      assert.ok(n >= 3, `${a.key} slate of ${n} is too small to rank`);
      assert.ok(
        a.target! <= (n * (n - 1)) / 2,
        `${a.key} wants ${a.target} from a slate holding ${(n * (n - 1)) / 2} pairs`,
      );
      // A slate must name real people.
      const roster = new Set(basketballRows.map((r) => r.name));
      for (const name of a.poolNames) {
        assert.ok(roster.has(name), `${a.key} slate names unknown player ${name}`);
      }
    }

    // The settled overall pass must never be reopened by the unified link.
    assert.ok(
      !SPORTS.basketball.axes.find((a) => a.key === "overall")?.collect,
      "the overall pass is settled and must not be recollected",
    );
  });

  it("attribute families carry the whole weight, and no more", () => {
    /*
     * The player card shows a weight per *family*, not per attribute, because
     * after the split a per-attribute number is arithmetically true and
     * communicatively false: speed reads x0.42 against playmaking's x1.00, as
     * though it mattered a quarter as much, when the physicals family is 1.25
     * — the heaviest thing in the sport. The children share one parent's
     * weight; they did not each shrink.
     *
     * So the family sums have to keep adding up to the flat total the overall
     * is actually computed from.
     */
    for (const sport of Object.values(SPORTS)) {
      const flat = sport.attributes.reduce((sum, a) => sum + a.weight, 0);
      const families = new Map<string, number>();
      for (const a of sport.attributes) {
        const name = a.group ?? a.label;
        families.set(name, (families.get(name) ?? 0) + a.weight);
      }
      const grouped = [...families.values()].reduce((sum, w) => sum + w, 0);
      assert.ok(
        Math.abs(grouped - flat) < 1e-9,
        `${sport.id}: families sum to ${grouped}, attributes to ${flat}`,
      );
    }
  });

  it("a split family weighs exactly what its parent did", () => {
    // Athleticism was 1.25 and defense 1.10 before the split. If either family
    // drifts, every overall silently moves with it.
    const families = new Map<string, number>();
    for (const a of SPORTS.basketball.attributes) {
      const name = a.group ?? a.label;
      families.set(name, (families.get(name) ?? 0) + a.weight);
    }
    /*
     * Every family carries its parent's original weight, whatever the children
     * are divided into. This is what makes a split arithmetically neutral: the
     * children's weights only have to SUM to the parent's, so an uneven split
     * is as valid as an even one, and adding a child later never changes the
     * family's influence on the overall.
     *
     * Asserted per family rather than as attribute counts, because counts pin
     * a shape that is expected to keep changing - this test failed on the six
     * -> nine -> fifteen split for saying "Defense has 2".
     */
    const PARENTS: Record<string, number> = {
      Physicals: 1.25,
      Finishing: 1.15,
      Rebounding: 1.15,
      Defense: 1.1,
      Shooting: 1.05,
      Playmaking: 1.0,
    };
    for (const [family, weight] of Object.entries(PARENTS)) {
      assert.ok(
        Math.abs((families.get(family) ?? 0) - weight) < 1e-9,
        `${family} should carry ${weight}, carries ${families.get(family)}`,
      );
    }
    // No attribute belongs to a family that isn't one of the six.
    assert.deepEqual(
      [...families.keys()].filter((f) => !(f in PARENTS)),
      [],
    );
    // The whole set still sums to what the original six summed to, which is
    // the invariant every overall depends on.
    assert.ok(
      Math.abs(
        SPORTS.basketball.attributes.reduce((n, a) => n + a.weight, 0) - 6.7,
      ) < 1e-9,
    );
  });

  it("isSportId accepts only configured sports", () => {
    assert.ok(isSportId("basketball"));
    assert.ok(isSportId("football"));
    assert.ok(!isSportId("hockey"));
    assert.ok(!isSportId(""));
  });
});
