# Run It Back

Pickup teams without re-prompting a chatbot every week. The roster is stored once;
each session you tap who showed up and get balanced teams.

## How it works

- **Roster** — each person is rated 25–99 on six sport-specific attributes, which
  roll up into a weighted overall. One person, one row — a friend who hoops *and*
  plays football has two profiles under the same name.
- **Run it** — tap who's here, choose 2–4 teams, generate.
- **Balancing** — `lib/balance.ts` runs 240 randomized greedy drafts, each refined
  by hill-climbing swaps. It optimises team strength, roster size, and position
  spread simultaneously, and honours "keep these two together / apart" rules.
  Pure math, no API call: ~18ms for 12 players.
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

Add an entry to `SPORTS` in `lib/sports.ts` — attributes, weights, and positions.
Everything else (roster UI, editor sliders, balancing, share pages) reads from
that config, so no other file needs to change.

## Checking the balancer

```bash
npx tsx scripts/balance-check.ts
```

Prints team splits, spreads, and constraint handling for a sample 12-player pool.
