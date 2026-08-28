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
      .$type<
        {
          players: {
            id: string;
            name: string;
            overall: number;
            position: string;
            /**
             * Carried into the snapshot because a spot can be filled from an
             * attribute rather than a position — football's quarterback goes
             * to the best thrower — and a share link has to lay out the same
             * lineup months later without consulting the live roster.
             */
            ratings?: Record<string, number>;
            heightInches?: number | null;
          }[];
        }[]
      >()
      .notNull(),
    spread: integer("spread").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("runs_sport_idx").on(table.sport)],
);

/**
 * One pairwise judgement: "who'd you rather have, A or B?"
 *
 * The point of this table is that it is the only rating signal in the app that
 * did not come from one person. Overalls are a weighted mean of attributes that
 * a single rater assigned, so every number downstream of them inherits that
 * rater's bias. A pairwise comparison is a question people can answer
 * accurately without a calibrated scale, and collecting it from the whole group
 * turns one opinion into a consensus.
 *
 * Three things are stored that the naive version would drop, and each one buys
 * a bias correction later:
 *
 * - `raterId` — so a rater's own comparisons can be excluded (self-assessment
 *   in a friend group is large and one-directional) and so a careless or
 *   self-favouring rater can be found by their disagreement with the consensus.
 * - `leftId`/`rightId` as *presented*, with `winnerId` naming one of them. Side
 *   preference is a real effect; keeping the presented order means it can be
 *   measured rather than assumed absent.
 * - `pairKey` — sorted ids, unique per rater and axis, so nobody's opinion on
 *   the same pair is counted twice.
 */
export const comparisons = pgTable(
  "comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sport: text("sport").notNull(),
    /**
     * Which question was asked. "overall" is "who'd you rather have". The
     * column exists because the attributes are highly correlated - one axis
     * carries most of the signal - so extra axes are worth adding only for the
     * genuinely independent ones, and only once people finish the first pass.
     */
    axis: text("axis").notNull().default("overall"),
    raterId: uuid("rater_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Groups one sitting, so a rushed run-through can be spotted and dropped. */
    sessionId: text("session_id").notNull(),
    leftId: uuid("left_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    rightId: uuid("right_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Null means "no idea" - kept, because it is evidence the two are close. */
    winnerId: uuid("winner_id").references(() => players.id, {
      onDelete: "cascade",
    }),
    /** The two ids sorted and joined, so the unique index is order-free. */
    pairKey: text("pair_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("comparisons_rater_pair_unique").on(
      table.raterId,
      table.sport,
      table.axis,
      table.pairKey,
    ),
    index("comparisons_sport_axis_idx").on(table.sport, table.axis),
  ],
);

export type Player = typeof players.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Comparison = typeof comparisons.$inferSelect;
