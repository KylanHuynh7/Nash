"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { assertCanEdit, canEdit, editingIsGated } from "@/lib/edit-auth";
import { getDb } from "@/db";
import { comparisons, players, profiles, runs } from "@/db/schema";
import {
  RATING_MAX,
  RATING_MIN,
  SPORTS,
  type SportId,
  computeOverall,
  isSportId,
} from "@/lib/sports";
import type { BalancePlayer } from "@/lib/balance";

export type RosterEntry = BalancePlayer & {
  ratings: Record<string, number>;
  heightInches: number | null;
};

export async function getRoster(sport: SportId): Promise<RosterEntry[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      heightInches: players.heightInches,
      position: profiles.position,
      ratings: profiles.ratings,
      overall: profiles.overall,
    })
    .from(profiles)
    .innerJoin(players, eq(players.id, profiles.playerId))
    .where(eq(profiles.sport, sport))
    .orderBy(desc(profiles.overall), asc(players.name));

  return rows;
}

function clean(
  sport: SportId,
  raw: Record<string, unknown>,
): Record<string, number> {
  const config = SPORTS[sport];
  const out: Record<string, number> = {};
  for (const attr of config.attributes) {
    const value = Number(raw[attr.key]);
    out[attr.key] = Number.isFinite(value)
      ? Math.round(Math.min(RATING_MAX, Math.max(RATING_MIN, value)))
      : 70;
  }
  return out;
}

export type SavePlayerInput = {
  playerId?: string;
  name: string;
  sport: string;
  position: string;
  ratings: Record<string, number>;
  heightInches?: number | null;
};

export async function savePlayer(input: SavePlayerInput) {
  await assertCanEdit();

  if (!isSportId(input.sport)) throw new Error(`Unknown sport: ${input.sport}`);
  const sport = input.sport;
  const config = SPORTS[sport];

  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");

  const position = config.positions.some((p) => p.key === input.position)
    ? input.position
    : config.positions[0].key;
  const ratings = clean(sport, input.ratings);
  const overall = computeOverall(config, ratings);

  const db = getDb();

  // 4'0"-7'6" keeps a typo from turning into a nonsense roster entry.
  const rawHeight = input.heightInches;
  const heightInches =
    typeof rawHeight === "number" && Number.isFinite(rawHeight)
      ? Math.min(90, Math.max(48, Math.round(rawHeight)))
      : null;

  let playerId = input.playerId;
  if (playerId) {
    await db
      .update(players)
      .set({ name, heightInches })
      .where(eq(players.id, playerId));
  } else {
    const [created] = await db
      .insert(players)
      .values({ name, heightInches })
      .returning({ id: players.id });
    playerId = created.id;
  }

  await db
    .insert(profiles)
    .values({ playerId, sport, position, ratings, overall })
    .onConflictDoUpdate({
      target: [profiles.playerId, profiles.sport],
      set: { position, ratings, overall, updatedAt: new Date() },
    });

  revalidatePath(`/${sport}`);
  return { playerId };
}

/** Removes the player from this sport, and entirely if they play no others. */
export async function removePlayer(playerId: string, sport: string) {
  await assertCanEdit();

  if (!isSportId(sport)) throw new Error(`Unknown sport: ${sport}`);
  const db = getDb();

  await db
    .delete(profiles)
    .where(and(eq(profiles.playerId, playerId), eq(profiles.sport, sport)));

  const remaining = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.playerId, playerId));
  if (remaining.length === 0) {
    await db.delete(players).where(eq(players.id, playerId));
  }

  revalidatePath(`/${sport}`);
}

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function shortId(length = 7) {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const byte of bytes) out += ID_ALPHABET[byte % ID_ALPHABET.length];
  return out;
}

export async function saveRun(input: {
  sport: string;
  label?: string;
  teams: { players: BalancePlayer[] }[];
  spread: number;
}) {
  if (!isSportId(input.sport)) throw new Error(`Unknown sport: ${input.sport}`);
  const db = getDb();
  const id = shortId();
  await db.insert(runs).values({
    id,
    sport: input.sport,
    label: input.label?.trim() || null,
    teams: input.teams.map((t) => ({ players: t.players })),
    spread: Math.round(input.spread * 10),
  });
  return { id };
}

export async function getRun(id: string) {
  const db = getDb();
  const [row] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  return row ?? null;
}

export type EditAccess = { gated: boolean; unlocked: boolean };

export async function getEditAccess(): Promise<EditAccess> {
  return { gated: editingIsGated(), unlocked: await canEdit() };
}

export async function unlockEditing(passcode: string): Promise<boolean> {
  const { grantEditing } = await import("@/lib/edit-auth");
  return grantEditing(passcode);
}

export async function lockEditing(): Promise<void> {
  const { revokeEditing } = await import("@/lib/edit-auth");
  await revokeEditing();
}

/* ------------------------------------------------------------------ *
 * Pairwise comparisons
 *
 * The collector is deliberately ungated. A passcode on the one page that
 * gathers other people's opinions would defeat its purpose - the whole value
 * is in answers that did not come from the person holding the passcode.
 * ------------------------------------------------------------------ */

export type CompareBootstrap = {
  pool: { id: string; name: string; overall: number }[];
  /** Pair keys this rater has already answered, so a sitting resumes cleanly. */
  answered: string[];
  seen: Record<string, number>;
};

export async function getCompareBootstrap(
  sport: SportId,
  raterId: string | null,
  axis = "overall",
): Promise<CompareBootstrap> {
  const db = getDb();
  const pool = await db
    .select({
      id: players.id,
      name: players.name,
      overall: profiles.overall,
    })
    .from(profiles)
    .innerJoin(players, eq(players.id, profiles.playerId))
    .where(eq(profiles.sport, sport))
    .orderBy(asc(players.name));

  if (!raterId) return { pool, answered: [], seen: {} };

  const rows = await db
    .select({
      pairKey: comparisons.pairKey,
      leftId: comparisons.leftId,
      rightId: comparisons.rightId,
    })
    .from(comparisons)
    .where(
      and(
        eq(comparisons.sport, sport),
        eq(comparisons.axis, axis),
        eq(comparisons.raterId, raterId),
      ),
    );

  const seen: Record<string, number> = {};
  for (const row of rows) {
    seen[row.leftId] = (seen[row.leftId] ?? 0) + 1;
    seen[row.rightId] = (seen[row.rightId] ?? 0) + 1;
  }
  return { pool, answered: rows.map((r) => r.pairKey), seen };
}

export async function submitComparison(input: {
  sport: string;
  axis?: string;
  raterId: string;
  sessionId: string;
  leftId: string;
  rightId: string;
  /** Null is a real answer - "no idea" says the two are close. */
  winnerId: string | null;
}) {
  if (!isSportId(input.sport)) throw new Error(`Unknown sport: ${input.sport}`);
  if (input.leftId === input.rightId) throw new Error("A pair needs two people");

  // A rater judging themselves is the one comparison guaranteed to be biased,
  // so it is refused here as well as filtered in the picker - the action is a
  // public endpoint and the client is not the only way in.
  if (input.raterId === input.leftId || input.raterId === input.rightId) {
    throw new Error("A rater cannot be in their own comparison");
  }
  if (
    input.winnerId !== null &&
    input.winnerId !== input.leftId &&
    input.winnerId !== input.rightId
  ) {
    throw new Error("The winner has to be one of the pair");
  }

  const db = getDb();
  await db
    .insert(comparisons)
    .values({
      sport: input.sport,
      axis: input.axis ?? "overall",
      raterId: input.raterId,
      sessionId: input.sessionId,
      leftId: input.leftId,
      rightId: input.rightId,
      winnerId: input.winnerId,
      pairKey: pairKeyOf(input.leftId, input.rightId),
    })
    // Re-answering a pair keeps the first answer rather than erroring. A
    // second tap on a flaky connection is not a changed opinion.
    .onConflictDoNothing();
}

function pairKeyOf(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export type CompareProgress = {
  totalAnswers: number;
  raters: { id: string; name: string; answers: number }[];
};

export async function getCompareProgress(
  sport: SportId,
  axis = "overall",
): Promise<CompareProgress> {
  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      answers: sql<number>`count(*)::int`,
    })
    .from(comparisons)
    .innerJoin(players, eq(players.id, comparisons.raterId))
    .where(and(eq(comparisons.sport, sport), eq(comparisons.axis, axis)))
    .groupBy(players.id, players.name)
    .orderBy(desc(sql`count(*)`));

  return {
    totalAnswers: rows.reduce((sum, r) => sum + r.answers, 0),
    raters: rows,
  };
}
