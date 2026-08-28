"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SportShards from "@/components/SportShards";
import { isRaterToken, raterPath } from "@/lib/rater-token";
import type { SportConfig } from "@/lib/sports";

/**
 * Where the token is remembered, so someone who bookmarked the bare page or
 * reopened it from history is not sent back to their messages to find the link.
 *
 * It holds a *token*, not a player id, which is the difference that matters:
 * the only way a token gets in here is by arriving in a link, so a remembered
 * identity is still a link-derived one. The old key held whichever name the
 * rater tapped, which is exactly the claim that turned out to be unreliable.
 */
export const TOKEN_STORAGE_KEY = "nash:compare:token";
const LEGACY_RATER_KEY = "nash:compare:rater";

export function rememberToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    // A stored player id from the picker era is a stale identity claim, and the
    // whole point of this change is that those are not trusted any more.
    window.localStorage.removeItem(LEGACY_RATER_KEY);
  } catch {
    // Private windows throw. Not remembering the link is a minor inconvenience,
    // not a reason to fail — they still have the link they arrived on.
  }
}

/**
 * The remembered token, read as an external store rather than copied into state
 * inside an effect.
 *
 * Three values, and the third is the point. `"pending"` is what the server
 * renders and what the very first client paint sees, so neither one shows the
 * refusal before localStorage has been consulted — telling someone who has a
 * link that they need one, for a frame, is the same flash the old page had in
 * the other direction. `"none"` stands in for null so the snapshot is a stable
 * primitive across renders, which is what `useSyncExternalStore` requires.
 */
type Stored = "pending" | "none" | string;

function readToken(): Stored {
  try {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return isRaterToken(stored) ? stored : "none";
  } catch {
    // Private windows throw on access.
    return "none";
  }
}

const pending = (): Stored => "pending";
const noSubscribe = () => () => {};

function forgetToken() {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to do — a token that cannot be cleared also could not be read.
  }
}

/**
 * The two ways to arrive at the collector without a working link.
 *
 * `missing` — no `?rater=` at all. Usually a bookmark or a back-button, so a
 * remembered token is looked for before anything is said to the rater.
 *
 * `invalid` — a token that resolves to nobody. The remembered copy is cleared
 * on the way in, because if the redirect below is what produced this state then
 * leaving it in place would bounce them straight back here on every visit.
 */
export default function CompareLinkGate({
  config,
  state,
}: {
  config: SportConfig;
  state: "missing" | "invalid";
}) {
  const router = useRouter();
  const stored = useSyncExternalStore(noSubscribe, readToken, pending);
  // An invalid token is answered immediately: there is nothing to look up, and
  // the stored copy is about to be thrown away regardless.
  const remembered = state === "invalid" || stored === "none" ? null : stored;

  useEffect(() => {
    if (state === "invalid") {
      // If the redirect below is what produced this state, leaving the stale
      // token in place would bounce them back here on every single visit.
      forgetToken();
      return;
    }
    if (remembered && remembered !== "pending") {
      router.replace(raterPath(config.id, remembered));
    }
  }, [state, remembered, router, config.id]);

  // Nothing is said until localStorage has been read, and nothing is said to
  // someone who is already on their way to their own link.
  if (remembered) return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-16 pt-6 lg:max-w-xl lg:px-8 lg:pt-10">
      <SportShards accent={config.accent} veil={0.3} />

      <header className="mb-8">
        <Link
          href={`/${config.id}`}
          className="text-sm text-ink-soft transition hover:text-ink"
        >
          ← {config.label}
        </Link>
        <h1 className="metal mt-3 text-2xl leading-none">
          {config.axes[0].heading}
        </h1>
      </header>

      <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-lg font-semibold text-foreground">
          {state === "invalid"
            ? "That link doesn't work any more."
            : "You'll need your own link."}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Everyone gets a personal link so their answers are filed under the
          right name — and so nobody is ever asked to rate themselves. Ask
          whoever sent you here to forward yours.
        </p>
        <Link
          href={`/${config.id}`}
          className="mt-5 inline-block rounded-xl border border-line bg-surface px-4 py-3 text-sm text-foreground transition hover:border-line-strong hover:bg-sunken"
        >
          Back to {config.label}
        </Link>
      </div>
    </main>
  );
}
