/**
 * Per-person tokens for the comparison collector's links.
 *
 * ## Why this exists
 *
 * The collector used to be one public link with a dropdown of names, and the
 * rater picked their own. Two of the five raters in the 2026-08-28 collection
 * completed an entire sitting under someone else's name. Nothing in the data
 * revealed it — the rows were well formed, the timings normal, the judgements
 * perfectly good. Only the name on them was wrong, and both were caught purely
 * because the person mentioned their question count in conversation.
 *
 * That is not a cosmetic problem. Every per-rater correction the app makes —
 * self-exclusion, inter-rater agreement, down-weighting a careless rater —
 * assumes the identity is real. When Justin answered as Taha, the app dutifully
 * excluded *Taha* from the pairs, so Justin judged himself ten times and Taha
 * appeared in none of that sitting's questions at all.
 *
 * A better dropdown is not the fix, because the app already is one. The fix is
 * to remove the choice: one link per person, the token carries the identity,
 * and there is nothing to get wrong.
 *
 * ## What a token is not
 *
 * It is **attribution, not authentication**. A token pasted into a group chat
 * works for whoever opens it, and nothing here tries to prevent that. The
 * failure being designed out is the accidental one — picking the wrong name off
 * a list — which is the one that actually happened, twice. Deliberate
 * impersonation in a friend group of seventeen is not the threat.
 *
 * It is also not the player id. Ids are already public on the compare page (the
 * pool is sent to the client to pick pairs from), so a token that *was* the id
 * would let anyone assemble anyone's link straight off the page they are
 * already looking at. A separate secret costs one column.
 */

/**
 * Crockford-ish base32: no `0`/`o`, no `1`/`i`/`l`. These get pasted into
 * messages and occasionally retyped off a screen, and the ambiguous pairs are
 * where that goes wrong.
 */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** ~49 bits. Far past accidental collision, and still short enough to retype. */
const LENGTH = 10;

/**
 * A fresh token.
 *
 * Rejection-samples rather than taking `byte % 31`, which would make the first
 * eight letters of the alphabet ~15% likelier than the rest. The bias would be
 * harmless here, but a token generator that quietly isn't uniform is the kind
 * of thing that gets copied somewhere it matters.
 */
export function newRaterToken(): string {
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  const buf = new Uint8Array(LENGTH * 2);
  while (out.length < LENGTH) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (out.length === LENGTH) break;
      if (byte >= max) continue;
      out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return out;
}

/**
 * Whether a string could be a token at all.
 *
 * Cheap enough to run before touching the database, which keeps a bogus or
 * truncated `?rater=` value from becoming a query. Says nothing about whether
 * the token exists — only the database knows that.
 */
export function isRaterToken(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== LENGTH) return false;
  for (const char of value) {
    if (!ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * The link one person opens to rate. Relative, so it works on any host.
 *
 * The axis rides in the link rather than being chosen on the page, which keeps
 * one link doing one job: you send the throwing pass when you want the throwing
 * pass. Asking for two passes up front is how you get neither. The default axis
 * is left out of the URL so the ordinary link stays short.
 */
export function raterPath(sport: string, token: string, axis?: string): string {
  const base = `/compare/${sport}?rater=${token}`;
  return axis && axis !== "overall" ? `${base}&axis=${axis}` : base;
}
