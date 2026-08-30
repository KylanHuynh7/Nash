import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  SIGNATURE_SD,
  TIERS,
  deriveBadges,
  featured,
  residualStats,
  tierFor,
} from "@/lib/badges";
import { SPORTS, computeOverall, RATING_MAX, RATING_MIN } from "@/lib/sports";

const config = SPORTS.basketball;
const keys = config.attributes.map((a) => a.key);

/** A player at one flat number, so a single attribute can be moved in isolation. */
function flat(value: number, overrides: Record<string, number> = {}) {
  const ratings = Object.fromEntries(keys.map((k) => [k, value]));
  return { ratings: { ...ratings, ...overrides } };
}

/**
 * Seventeen players who are spread across the band AND differently shaped.
 *
 * Both halves matter. A roster of flat players has a zero residual spread on
 * every attribute, so no signature badge can ever fire and a test asserting one
 * is really asserting the divide-by-zero guard. The rotating offset gives each
 * attribute a genuine spread of lopsidedness to standardise against.
 */
function spreadRoster() {
  return Array.from({ length: 17 }, (_, i) => {
    const base = RATING_MIN + i * 2;
    const shaped = Object.fromEntries(
      keys.map((k, j) => [
        k,
        Math.min(RATING_MAX, Math.max(RATING_MIN, base + (((i + j) % 5) - 2) * 3)),
      ]),
    );
    return { ratings: shaped };
  });
}

describe("badge tiers", () => {
  it("places the cuts on Nash's own band, not 2K's numbers", () => {
    // 2K's Bronze Deadeye wants 65 three-point. Here 65 is the floor of the
    // group, so a badge at 65 would be held by all seventeen (context.md 6b).
    assert.equal(tierFor(RATING_MIN), null);
    assert.equal(tierFor(75), null);
    assert.equal(tierFor(76), "bronze");
    assert.equal(tierFor(84), "silver");
    assert.equal(tierFor(91), "gold");
    assert.equal(tierFor(RATING_MAX), "hof");
  });

  it("orders the tiers and never lets two share a cut", () => {
    const mins = TIERS.map((t) => t.min);
    assert.deepEqual(mins, [...mins].sort((a, b) => a - b));
    assert.equal(new Set(mins).size, mins.length);
  });
});

describe("deriveBadges", () => {
  it("never modifies a rating or the overall", () => {
    // The rule the whole module exists to keep (2c): a badge that raised the
    // attribute that produced it would re-earn itself.
    const player = flat(88);
    const before = JSON.stringify(player.ratings);
    const overall = computeOverall(config, player.ratings);
    deriveBadges(config, player.ratings, spreadRoster());
    assert.equal(JSON.stringify(player.ratings), before);
    assert.equal(computeOverall(config, player.ratings), overall);
  });

  it("awards nothing at the floor - no weakness badges", () => {
    // 6a decided against them: the rule run negative is accurate and brutal.
    const badges = deriveBadges(config, flat(RATING_MIN).ratings, spreadRoster());
    assert.deepEqual(badges, []);
  });

  it("gives every attribute badge to a maxed player, at Hall of Fame", () => {
    const badges = deriveBadges(config, flat(RATING_MAX).ratings, spreadRoster());
    const attribute = badges.filter((b) => b.family === "attribute");
    assert.equal(attribute.length, keys.length);
    assert.ok(attribute.every((b) => b.tier === "hof"));
  });

  it("names only attributes the sport actually has", () => {
    // The nine-attribute draft of 6i named Shooting, Finishing, Playmaking and
    // Rebounding, which stopped being attributes at the second split.
    const badges = deriveBadges(config, flat(RATING_MAX).ratings, spreadRoster());
    for (const badge of badges) {
      for (const key of badge.attributes) {
        assert.ok(keys.includes(key), `${badge.name} names missing "${key}"`);
      }
    }
  });

  it("issues no duplicate badge keys or names", () => {
    const badges = deriveBadges(config, flat(RATING_MAX).ratings, spreadRoster());
    assert.equal(new Set(badges.map((b) => b.key)).size, badges.length);
    assert.equal(new Set(badges.map((b) => b.name)).size, badges.length);
  });
});

describe("signature badges", () => {
  it("awards nobody when an attribute is a constant", () => {
    // Every player equally lopsided is not a signature, it is a constant - and
    // dividing by a zero spread would otherwise badge all seventeen.
    const roster = Array.from({ length: 17 }, () => flat(80));
    const badges = deriveBadges(config, flat(80).ratings, roster);
    assert.equal(badges.filter((b) => b.family === "signature").length, 0);
  });

  it("is relative to the roster, not absolute", () => {
    // The same player signs an attribute or does not, depending only on how
    // lopsided everyone else is toward it.
    const player = flat(80, { three_point: 92 });
    const flatRoster = [...spreadRoster(), player];
    const lopsidedRoster = [
      ...spreadRoster().map((p) => ({
        ratings: { ...p.ratings, three_point: p.ratings.three_point + 14 },
      })),
      player,
    ];
    const signs = (roster: ReturnType<typeof spreadRoster>) =>
      deriveBadges(config, player.ratings, roster).some((b) => b.key === "sig_three_point");
    assert.equal(signs(flatRoster), true);
    assert.equal(signs(lopsidedRoster), false);
  });

  it("needs the residual to clear the stated standard deviation", () => {
    // A signature badge carries its own z as `score`, so the bar can be pinned
    // exactly rather than by reverse-engineering a boundary rating.
    const roster = spreadRoster();
    assert.ok(residualStats(config, roster).get("block")!.sd > 0);

    for (let block = RATING_MIN; block <= RATING_MAX; block++) {
      const player = flat(80, { block });
      for (const badge of deriveBadges(config, player.ratings, roster)) {
        if (badge.family !== "signature") continue;
        assert.ok(
          badge.score >= SIGNATURE_SD,
          `${badge.name} awarded at ${badge.score.toFixed(2)}sd`,
        );
      }
    }
  });

  it("signs an attribute once it is lopsided enough, and not before", () => {
    const roster = spreadRoster();
    const signs = (block: number) =>
      deriveBadges(config, flat(80, { block }).ratings, roster).some(
        (b) => b.key === "sig_block",
      );
    assert.equal(signs(80), false);
    assert.equal(signs(RATING_MAX), true);

    // Monotone: once it signs, raising the attribute never un-signs it.
    let seen = false;
    for (let block = RATING_MIN; block <= RATING_MAX; block++) {
      const now = signs(block);
      if (seen) assert.ok(now, `un-signed at ${block}`);
      seen ||= now;
    }
  });
});

describe("combination badges", () => {
  it("requires every clause, not merely one", () => {
    // Anchor is interior_d >= Gold AND def_reb >= Gold.
    const half = flat(RATING_MIN, { interior_d: 95 });
    const badges = deriveBadges(config, half.ratings, spreadRoster());
    assert.ok(!badges.some((b) => b.name === "Anchor"));

    const both = flat(RATING_MIN, { interior_d: 95, def_reb: 95 });
    assert.ok(
      deriveBadges(config, both.ratings, spreadRoster()).some((b) => b.name === "Anchor"),
    );
  });

  it("accepts any one branch of an OR", () => {
    // Two-Way is perimeter_d >= S AND (three_point >= S OR driving_layup >= S).
    const viaShooting = flat(RATING_MIN, { perimeter_d: 88, three_point: 88 });
    const viaFinishing = flat(RATING_MIN, { perimeter_d: 88, driving_layup: 88 });
    const neither = flat(RATING_MIN, { perimeter_d: 88 });
    const holds = (p: { ratings: Record<string, number> }) =>
      deriveBadges(config, p.ratings, spreadRoster()).some((b) => b.name === "Two-Way");
    assert.equal(holds(viaShooting), true);
    assert.equal(holds(viaFinishing), true);
    assert.equal(holds(neither), false);
  });

  it("names only the OR branch it was actually earned on", () => {
    /*
     * The card prints `attributes` as the evidence behind a badge, so an OR
     * branch the player failed must not appear there — it makes an alternative
     * read as a requirement. Caught in a browser, not by a test: Orion's
     * Two-Way cited Man Coverage, Hands AND Short Routes when the rule asks
     * for Man Coverage plus either of the other two.
     */
    const viaShooting = flat(RATING_MIN, { perimeter_d: 88, three_point: 88 });
    const badge = deriveBadges(config, viaShooting.ratings, spreadRoster()).find(
      (b) => b.name === "Two-Way",
    );
    assert.ok(badge);
    assert.deepEqual([...badge.attributes].sort(), ["perimeter_d", "three_point"]);
    // And the unmet branch must not drag the score it is ranked on.
    assert.ok(badge.score > RATING_MIN / 99);
  });

  it("gives Swiss Army only when nothing is below Bronze", () => {
    const clean = flat(76);
    const oneHole = flat(76, { steal: 75 });
    const holds = (p: { ratings: Record<string, number> }) =>
      deriveBadges(config, p.ratings, spreadRoster()).some((b) => b.name === "Swiss Army");
    assert.equal(holds(clean), true);
    assert.equal(holds(oneHole), false);
  });
});

describe("featured", () => {
  it("shows three, and never invents one", () => {
    const many = deriveBadges(config, flat(RATING_MAX).ratings, spreadRoster());
    assert.equal(featured(many).length, 3);
    const none = deriveBadges(config, flat(RATING_MIN).ratings, spreadRoster());
    assert.equal(featured(none).length, 0);
  });

  it("features a signature over a bare attribute badge", () => {
    // 6a: the standardised residual separates "he is good at this" from "this
    // is who he is", and the second is the more interesting thing on a card.
    const player = flat(70, { three_point: 88 });
    const roster = [...spreadRoster(), player];
    const top = featured(deriveBadges(config, player.ratings, roster), 1);
    assert.equal(top[0]?.family, "signature");
  });
});
