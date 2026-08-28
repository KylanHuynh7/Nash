import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isRaterToken, newRaterToken, raterPath } from "@/lib/rater-token";
import { basketballPool } from "./fixtures";

describe("rater tokens", () => {
  it("issues tokens it recognises", () => {
    for (let i = 0; i < 200; i++) {
      assert.ok(isRaterToken(newRaterToken()));
    }
  });

  it("does not repeat itself", () => {
    // Not a real collision test — 31^10 is far past what a loop can probe. It
    // catches the failure that actually happens: a generator seeded once, or
    // one that returns a constant because the fill loop is wrong.
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(newRaterToken());
    assert.equal(seen.size, 2000);
  });

  it("uses no character that can be misread", () => {
    // These get pasted into messages and occasionally retyped off a screen.
    const ambiguous = /[01ilo]/;
    for (let i = 0; i < 500; i++) {
      assert.ok(!ambiguous.test(newRaterToken()));
    }
  });

  it("draws every letter of its alphabet", () => {
    // A modulo bias would still pass the tests above while making some letters
    // ~15% likelier. This asserts the whole alphabet is reachable at all, which
    // is what a broken rejection-sampling loop would break.
    const chars = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      for (const c of newRaterToken()) chars.add(c);
    }
    assert.equal(chars.size, 31);
  });

  it("refuses everything that is not a token", () => {
    for (const bad of [
      null,
      undefined,
      42,
      "",
      "short",
      `${newRaterToken()}x`, // too long
      newRaterToken().slice(1), // too short
      "abcdefgh1o", // contains excluded characters
      "ABCDEFGHJK", // uppercase is not the alphabet
      ["abcdefghjk"], // a repeated ?rater= arrives as an array
    ]) {
      assert.equal(isRaterToken(bad), false, `accepted ${JSON.stringify(bad)}`);
    }
  });

  it("never accepts a player id as a token", () => {
    // The ids are public — the whole pool is sent to the client so pairs can be
    // picked without a round trip. If an id validated as a token, anyone could
    // assemble anyone else's link off the page they were already looking at,
    // which is the impersonation this change exists to remove.
    for (const player of basketballPool()) {
      assert.equal(isRaterToken(player.id), false);
    }
  });

  it("builds a link the page can read back", () => {
    const token = newRaterToken();
    const path = raterPath("basketball", token);
    assert.equal(path, `/compare/basketball?rater=${token}`);

    const parsed = new URL(path, "https://nash-teams.vercel.app");
    assert.equal(parsed.pathname, "/compare/basketball");
    assert.equal(parsed.searchParams.get("rater"), token);
    // No escaping anywhere in the alphabet, so a link survives being pasted
    // into a chat client that mangles percent-encoding.
    assert.equal(encodeURIComponent(token), token);
  });
});
