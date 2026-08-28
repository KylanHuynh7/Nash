/**
 * Resolving a comparison link's token to the person who holds it.
 *
 * Server-only: it touches the database and it is deliberately *not* a server
 * action. Every export from `app/actions.ts` is a public endpoint, and a
 * token-to-name lookup exposed that way is an oracle someone could walk to
 * enumerate tokens. The page is a server component and can call this directly,
 * so there is no reason to publish it.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { players } from "@/db/schema";
import { isRaterToken } from "@/lib/rater-token";

export type Rater = { id: string; name: string };

/**
 * The person a `?rater=` token belongs to, or null.
 *
 * Null covers every way a link can fail — malformed, mistyped, or issued
 * against a player who has since been removed — because the page says the same
 * thing in all three cases and telling them apart would only help someone
 * probing for valid tokens.
 */
export async function resolveRater(token: unknown): Promise<Rater | null> {
  // Shape-checked before the query, so a junk query string never becomes a
  // database round trip.
  if (!isRaterToken(token)) return null;

  const db = getDb();
  const [row] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.raterToken, token))
    .limit(1);

  return row ?? null;
}
