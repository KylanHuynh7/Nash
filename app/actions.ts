"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { players, profiles, runs } from "@/db/schema";
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
