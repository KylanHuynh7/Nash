import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** One row per person, shared across every sport they show up for. */
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Approximate height in inches. Sport-independent, so it carries across. */
  heightInches: integer("height_inches"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A person's ratings for one sport. Someone who hoops and plays football has two. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    sport: text("sport").notNull(),
    position: text("position").notNull(),
    /** Attribute key -> 25-99 rating. Keys come from the sport config. */
    ratings: jsonb("ratings").$type<Record<string, number>>().notNull(),
    /** Denormalised weighted average so lists can sort without recomputing. */
    overall: integer("overall").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("profiles_player_sport_unique").on(table.playerId, table.sport),
    index("profiles_sport_idx").on(table.sport),
  ],
);

/**
 * A saved matchup. Teams are stored as a snapshot rather than as references so
 * an old share link keeps showing the ratings the teams were actually built from.
 */
export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    sport: text("sport").notNull(),
    label: text("label"),
    teams: jsonb("teams")
      .$type<{ players: { id: string; name: string; overall: number; position: string }[] }[]>()
      .notNull(),
    spread: integer("spread").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("runs_sport_idx").on(table.sport)],
);

export type Player = typeof players.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Run = typeof runs.$inferSelect;
