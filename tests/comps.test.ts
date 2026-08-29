import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { verdict } from "@/lib/comps";
import { normalizeComp, NBA_COMP_NAMES, NBA_COMPS } from "@/lib/nba";

const votes = (...list: (string | null)[]) =>
  list.map((comp, i) => ({ subjectId: "s", comp, rater: `r${i}` }));

describe("verdict", () => {
  it("needs two agreeing before it speaks for the group", () => {
    // One person's answer rendered as "the group" is the failure this app has
    // already had twice.
    assert.equal(verdict(votes("Draymond Green")).comp, null);
    assert.equal(
      verdict(votes("Draymond Green", "Draymond Green")).comp,
      "Draymond Green",
    );
  });

  it("returns the raw list even below the bar, so a card can attribute it", () => {
    const v = verdict(votes("Draymond Green"));
    assert.equal(v.comp, null);
    assert.deepEqual(v.all, [{ comp: "Draymond Green", votes: 1 }]);
  });

  it("refuses to break a tie at the top", () => {
    // Two names at two votes each is the group being split. Picking one
    // alphabetically would invent a consensus out of a coin flip.
    const v = verdict(votes("Kobe Bryant", "Kobe Bryant", "Kyrie Irving", "Kyrie Irving"));
    assert.equal(v.comp, null);
    assert.equal(v.all.length, 2);
  });

  it("counts skips as answers but never lets one win", () => {
    // "Nobody had a comp for him" is a real finding about a player. It is not
    // a comp.
    const v = verdict(votes(null, null, null));
    assert.equal(v.comp, null);
    assert.equal(v.answers, 3);
    assert.deepEqual(v.all, []);
  });

  it("lets a real comp win over more skips", () => {
    const v = verdict(votes(null, null, "Bam Adebayo", "Bam Adebayo"));
    assert.equal(v.comp, "Bam Adebayo");
    assert.equal(v.votes, 2);
    assert.equal(v.answers, 4);
  });

  it("is empty on no votes", () => {
    const v = verdict([]);
    assert.equal(v.comp, null);
    assert.equal(v.answers, 0);
  });
});

describe("normalizeComp", () => {
  it("keeps a free-text answer verbatim apart from whitespace", () => {
    // Normalising "mini LeBron" into "LeBron James" would erase the very
    // distinction the rater was drawing.
    assert.equal(normalizeComp("  mini   LeBron "), "mini LeBron");
  });

  it("treats an empty answer as no comp, which is a real answer", () => {
    assert.equal(normalizeComp("   "), null);
    assert.equal(normalizeComp(""), null);
    assert.equal(normalizeComp(undefined), null);
    assert.equal(normalizeComp(42), null);
  });

  it("caps length so a pasted essay cannot become a comp", () => {
    assert.equal(normalizeComp("x".repeat(200))!.length, 60);
  });
});

describe("the NBA list", () => {
  it("has no duplicates across groups", () => {
    assert.equal(new Set(NBA_COMP_NAMES).size, NBA_COMP_NAMES.length);
  });

  it("gives every group a label and at least one name", () => {
    for (const group of NBA_COMPS) {
      assert.ok(group.label.length > 0);
      assert.ok(group.players.length > 0, `${group.label} is empty`);
    }
  });
});
