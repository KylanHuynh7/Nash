"use server";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { assertCanEdit, canEdit, editingIsGated } from "@/lib/edit-auth";
import { getDb } from "@/db";
import { comparisons, ticks, players, profiles, runs } from "@/db/schema";
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
  /**
   * `estimate` is the current number on the axis being collected, not always
   * the overall — a throwing pass steers on the throwing rating. It picks which
   * questions get asked and is never sent anywhere the rater can see it.
   */
  pool: { id: string; name: string; estimate: number }[];
  /** Pair keys this rater has already answered, so a sitting resumes cleanly. */
  answered: string[];
  seen: Record<string, number>;
};

/**
 * One axis's slice of a unified round: the pool as that axis sees it, plus what
 * this rater has already answered on it.
 */
export type AxisBootstrap = CompareBootstrap & {
  axis: string;
  /**
   * For a tick axis: the subjects this rater already ticked.
   *
   * Present and possibly empty once the pass has been submitted, `undefined`
   * when it has not. That distinction is the whole reason `ticks` stores a row
   * per subject rather than a row per tick — "went through it and ticked
   * nobody" has to be tellable from "never opened it", because the first is
   * evidence an attribute is a constant.
   */
  ticked?: string[];
};

/**
 * Everything a multi-axis session needs, in one round trip.
 *
 * Fetched together rather than per block, because a rater who finishes the
 * stamina questions should move straight into strength — a loading pause
 * between blocks is the moment a three-minute session becomes a five-minute
 * one and somebody puts their phone down.
 */
export async function getRoundBootstrap(
  sport: SportId,
  raterId: string,
  axes: { key: string; mode?: "comparative" | "tick" }[],
): Promise<AxisBootstrap[]> {
  return Promise.all(
    axes.map(async (axis) => {
      const base = await getCompareBootstrap(sport, raterId, axis.key);
      if (axis.mode !== "tick") return { axis: axis.key, ...base };
      /*
       * A tick block resumes as "submitted or not", not as a set of answered
       * pairs. `answered` carries a single sentinel so the round's existing
       * progress arithmetic — count against a per-block target — works
       * unchanged, with the tick block's target being one pass.
       */
      const ticked = await getTickState(sport, raterId, axis.key);
      return {
        axis: axis.key,
        ...base,
        ticked: ticked ?? undefined,
        answered: ticked ? ["tick"] : [],
      };
    }),
  );
}

/**
 * What this rater said on one tick axis, or null if they have not answered it.
 *
 * Returns the ticked subjects only; the unticked ones are stored too (that is
 * how "answered, ticked nobody" stays distinguishable from "unanswered") but
 * the client only needs to restore the boxes that are on.
 */
export async function getTickState(
  sport: string,
  raterId: string,
  axis: string,
): Promise<string[] | null> {
  const db = getDb();
  const rows = await db
    .select({ subjectId: ticks.subjectId, ticked: ticks.ticked })
    .from(ticks)
    .where(
      and(
        eq(ticks.sport, sport),
        eq(ticks.axis, axis),
        eq(ticks.raterId, raterId),
      ),
    );
  if (rows.length === 0) return null;
  return rows.filter((r) => r.ticked === 1).map((r) => r.subjectId);
}

/**
 * Record one whole tick pass: every subject, ticked or not.
 *
 * Written as one statement per subject inside a single insert so that a pass
 * either lands complete or not at all — a half-written pass would read as a
 * finished one with a suspiciously short list, which is exactly the failure
 * `ticks` stores unticked rows to avoid.
 *
 * A rater is never a subject in their own pass. Self-assessment in a friend
 * group is large and one-directional, and it is refused here as well as
 * filtered in the UI because the action is a public endpoint.
 */
export async function submitTicks(input: {
  sport: string;
  axis: string;
  raterId: string;
  sessionId: string;
  /** Every subject shown, with whether the rater ticked them. */
  subjects: { id: string; ticked: boolean }[];
}) {
  if (!isSportId(input.sport)) throw new Error(`Unknown sport: ${input.sport}`);
  const axis = SPORTS[input.sport].axes.find((a) => a.key === input.axis);
  if (!axis || axis.mode !== "tick") {
    throw new Error(`Not a tick axis: ${input.axis}`);
  }
  const subjects = input.subjects.filter((s) => s.id !== input.raterId);
  if (subjects.length === 0) throw new Error("A pass needs subjects");

  const db = getDb();
  await db
    .insert(ticks)
    .values(
      subjects.map((s) => ({
        sport: input.sport,
        axis: input.axis,
        raterId: input.raterId,
        sessionId: input.sessionId,
        subjectId: s.id,
        ticked: s.ticked ? 1 : 0,
      })),
    )
    // Re-submitting a pass keeps the first answer, matching how a re-answered
    // comparison behaves. Changing one's mind is a re-send, not a silent
    // overwrite of data already fitted.
    .onConflictDoNothing();
}

export async function getCompareBootstrap(
  sport: SportId,
  raterId: string | null,
  axis = "overall",
): Promise<CompareBootstrap> {
  const db = getDb();
  const axisConfig = SPORTS[sport].axes.find((a) => a.key === axis);
  const attribute = axisConfig?.attribute;

  const profileRows = await db
    .select({
      id: players.id,
      name: players.name,
      overall: profiles.overall,
      ratings: profiles.ratings,
    })
    .from(profiles)
    .innerJoin(players, eq(players.id, profiles.playerId))
    .where(eq(profiles.sport, sport))
    .orderBy(asc(players.name));

  // An axis that names an attribute steers on that attribute. Falling back to
  // the overall when the rating is missing keeps a half-rated roster asking
  // sensible questions instead of treating everyone as identical.
  /*
   * A pool axis is restricted to its frozen slate.
   *
   * Filtered by name against the roster. An unmatched name is dropped rather
   * than thrown on: a slate is a hand-written list in the config and a roster
   * change should not 500 the collector for everybody. A slate that matches
   * fewer than two people leaves the block with no pairs, and `blockTargets`
   * caps its target to zero so the round skips it instead of stalling.
   */
  const slate = axisConfig?.poolNames;
  const pool = profileRows
    .filter((row) => !slate || slate.includes(row.name))
    .map((row) => ({
      id: row.id,
      name: row.name,
      estimate: attribute ? (row.ratings[attribute] ?? row.overall) : row.overall,
    }));

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
  if (input.leftId === input.rightId)
    throw new Error("A pair needs two people");

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
