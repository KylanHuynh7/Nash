# Nash

Pickup teams without re-prompting a chatbot every week. The roster is stored once;
each session you tap who showed up and get balanced teams.

Named for the **Nash equilibrium** — the state where no player improves the
outcome by unilaterally switching sides. That is literally the balancer's exit
condition: it swaps players between teams until no single swap makes the split
better, then stops. It is also a point guard whose whole game was making the
people around him even.

## How it works

- **Roster** — each person is rated 25–99 on six sport-specific attributes, which
  roll up into a weighted overall. One person, one row — a friend who hoops *and*
  plays football has two profiles under the same name.
- **Positions are where you line up, not what you are.** Both sports are played
  positionless. A sport may name a `decisiveAttribute` — the one attribute where
  a team's *best* matters more than its average — and a lineup spot may be filled
  `byAttribute` rather than by position. Football's quarterback works this way:
  nobody is labelled QB, and the spot goes to whoever on the side throws best,
  which is how the side would pick.
- **Run it** — tap who's here, choose 2–4 teams, generate.
- **Balancing** — `lib/balance.ts` runs 240 randomized greedy drafts, each refined
  by hill-climbing swaps. It optimises team strength, roster size, position
  spread, and parity on the sport's decisive attribute simultaneously, and
  honours "keep these two together / apart" rules. Pure math, no API call:
  ~37ms for 10 players, ~69ms for 17.
- **Share** — a generated matchup can be saved to a short link. Teams are stored
  as a snapshot, so an old link keeps showing the ratings the teams were built from.

## Local setup

```bash
npm install
vercel link                      # once
vercel env pull .env.local       # pulls DATABASE_URL from the Neon integration
npx dotenv -e .env.local -- npx drizzle-kit push
npm run dev
```

## Adding a sport

Add an entry to `SPORTS` in `lib/sports.ts` — attributes, weights, positions and
spots. Everything else (roster UI, editor sliders, balancing, share pages, and
the shard backdrop, which derives its whole palette from the sport's one accent)
reads from that config, so no other file needs to change.

Optional config worth knowing:

| Key | Effect |
|---|---|
| `decisiveAttribute` | Balanced on each team's **best**, not its average. For skills only one player uses at a time. |
| `spots[].byAttribute` | Fill this lineup spot with the team's best at that attribute instead of by position. |
| `spots[].position` | Several spots may claim the same position — two wide receivers both name `wr`. |
| `criticalPosition` | Warn when a team has none of this position. Currently unused by either sport. |

## Deploying

Live at **https://nash-teams.vercel.app** (Vercel project `nash`).

```bash
vercel --prod
```

`nash-teams.vercel.app` is registered as a *project domain*, so it follows each
production deploy. An alias created with `vercel alias set` would not — it pins
to the one build it was pointed at.

`EDIT_PASSCODE` must be set in Production or **the app fails open** and anyone
with the link can rewrite ratings. It is stored as a Secret, so `vercel env pull`
cannot read it back; `.env.local` is the only readable copy.

All environments share one `DATABASE_URL` — local development writes to the same
database production reads.

## Checking the balancer

```bash
npx tsx scripts/balance-check.ts
```

Prints team splits, spreads, and constraint handling for a sample 12-player pool.
