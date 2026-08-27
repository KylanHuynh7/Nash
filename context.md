# Nash — project context

Named for the **Nash equilibrium**: no player can improve the split by
unilaterally switching teams. That is the balancer's stopping condition, not a
metaphor — it hill-climbs swaps until none of them help. Steve Nash is the
second half of the joke.

A pickup teams app for one friend group. Store the roster once, tap who showed
up, get balanced teams. Built to kill the redundancy of re-describing fifteen
people to a chatbot every time you want to pick sides.

Two sports: **basketball** (complete) and **football** (page built, ratings
pending). Everything is driven from one config per sport, so a third sport is a
config entry, not a new app.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Styling | Tailwind v4, single dark theme (NBA 2K-inspired) |
| Database | Neon Postgres via Vercel Marketplace |
| ORM | Drizzle |
| Drag & drop | `@dnd-kit/core` |
| Hosting | Vercel — project `run-it-back`, **not yet deployed** |

Local: `npm run dev` → http://localhost:3000. On the same Wi-Fi, a phone can
reach it at the Network address `next dev` prints.

---

## Data model

Three tables. The split matters: **a person is not a sport profile.**

- **`players`** — one row per person. `name`, `height_inches`. Sport-independent,
  which is why height carried over to football for free.
- **`profiles`** — one row per person *per sport*. `position`, `ratings` (jsonb),
  `overall`. Unique on `(player_id, sport)`.
- **`runs`** — saved matchups behind a short share link. Teams are stored as a
  **snapshot**, not as references, so an old link keeps showing the ratings the
  teams were actually built from.

---

## How ratings work

### The scale is relative to this group

**65 = lowest of these seventeen. 99 = highest.** It is not a scale against
basketball at large. The floor was raised from 25 because a 45 read as "bad at
basketball" when it only ever meant "last pick here".

Lowering the floor further would **not** spread the bottom out — rescaling is a
linear transform, so it slides every number down and preserves the gaps. The
bottom five are bunched because they are genuinely similar, not because of where
the floor sits. If more separation is ever wanted, that is a *rating* change, not
a *scale* change.

### Overall is a weighted mean

```
overall = Σ(attribute × weight) ÷ Σ(weights)
```

Basketball weights, set for **full court to 11**:

| Attribute | Weight | Why |
|---|---|---|
| Athleticism | 1.25 | You run all game; the man still going at 9-9 decides it |
| Finishing | 1.15 | Transition buckets |
| Rebounding | 1.15 | A defensive board is a fast break, not just a possession |
| Defense | 1.10 | |
| Shooting | 1.05 | |
| Playmaking | 1.00 | |

These were half-court weights originally (shooting 1.15, rebounding 0.85) and
were re-derived once it was clear the games are full court.

### How a player gets rated

Three passes:

1. **Rank off the draft-round question.** "What round does he go?" is the only
   genuinely comparative question, so it sets the ladder.
2. **Shape the six attributes** from the behavioural answers within that slot.
3. **Check the computed overall against the ladder** and adjust until they agree.

The ten questions are behavioural on purpose — what a player *does* is more
reliably answered than how good he is out of ten.

### Two findings worth keeping

**Weights barely matter.** Tested against a flat average and a rebound-heavy
scheme: the top five and bottom five never move. Only the 6–10 cluster shuffles.

**Why they barely matter** — shooting, finishing and playmaking correlate at
**0.88–0.94**. They are not three attributes, they are "can he play offence"
measured three times, and they carry ~48% of the weight. Rebounding is the most
*independent* attribute (0.43 average correlation), athleticism second (0.57).

**So feedback should target individual attributes — especially rebounding,
defense, athleticism — not the weights and not the overall.** A disagreement
about shooting is mostly redundant with finishing.

---

## The roster

Seventeen people. Basketball ratings below; football profiles exist but are flat.

| # | Player | Pos | Ht | OVR | SHOOT | FINISH | PLAY | DEF | REB | ATH |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Taha | PG | 6'2" | **96** | 95 | 96 | 99 | 97 | 88 | 99 |
| 2 | Brendan | SG | 5'10" | **91** | 93 | 93 | 90 | 95 | 78 | 96 |
| 3 | Orion | SF | 5'10" | **90** | 93 | 94 | 85 | 88 | 82 | 96 |
| 4 | Joe | SF | 6'2" | **85** | 90 | 88 | 82 | 92 | 82 | 76 |
| 5 | Victor | PG | 5'11" | **85** | 87 | 84 | 88 | 87 | 79 | 84 |
| 6 | Eric | PG | 5'5" | **82** | 88 | 90 | 86 | 72 | 66 | 90 |
| 7 | David | SG | 5'6" | **81** | 82 | 78 | 80 | 94 | 70 | 80 |
| 8 | Jason | C | 6'1" | **81** | 85 | 80 | 80 | 82 | 91 | 70 |
| 9 | Kylan | PF | 5'10" | **81** | 71 | 79 | 81 | 81 | 89 | 83 |
| 10 | Bang | SG | 5'10" | **79** | 92 | 93 | 87 | 65 | 65 | 75 |
| 11 | Lucas | SF | 5'10" | **76** | 78 | 76 | 74 | 72 | 72 | 83 |
| 12 | Rayan | SF | 5'9" | **74** | 69 | 70 | 67 | 72 | 78 | 86 |
| 13 | Danny | PG | 5'6" | **71** | 76 | 68 | 66 | 70 | 65 | 78 |
| 14 | Brian | PG | 5'5" | **70** | 72 | 70 | 67 | 66 | 65 | 80 |
| 15 | Sean | PF | 5'10" | **67** | 68 | 66 | 65 | 67 | 67 | 68 |
| 16 | Alfonso | SF | 5'8" | **66** | 68 | 67 | 65 | 66 | 65 | 65 |
| 17 | Justin | SF | 5'9" | **65** | 65 | 65 | 65 | 65 | 65 | 66 |

Known soft spots: **Bang's 65 defense** is floored and arguably should sit below
Justin's ("zero defensive capabilities" vs "tries, just isn't good"), which makes
his 79 slightly generous. **Joe** is the most format-sensitive player — 76
athleticism with "gasses out" costs him more full court than it would half.

---

## What's built

### Balancing (`lib/balance.ts`)

240 randomised greedy drafts, each refined by hill-climbing swaps. Optimises
team strength, roster size and position spread simultaneously. Honours
together/apart pairing rules. ~18ms for twelve players.

**Measured: 20 consecutive generations from the 17-man pool all produced a
spread of 0.0** — identical team averages every time.

### The three-stage flow

1. **Who showed up** — from the whole pool
2. **On the court/field** — from those present, chosen by hand or by **Auto-pick**,
   which gives the floor to whoever has waited longest
3. **Generate** — teams built from the on-court set only

The app used to choose who sits. It doesn't any more — that's the user's call,
and auto-pick is a convenience rather than a rule. Waiting players carry a badge
showing how many games they've sat.

### Court / field view

Both teams stacked at each of five spots, so a game reads as five matchups
rather than two lists. **Two teams with identical averages can still be lopsided
at three positions, and only this view shows that.**

The advantage delta carries **three independent signals** so it can't be read
backwards: it sits on the row of the player who holds it, renders in that team's
colour, and the bar underneath names the team outright.

**Placement rules:**
- Stated position first; leftovers fill open spots
- A **height-settling pass** stops a 5'5" guard landing at centre, with a **3"
  tolerance**. It only ever moves a player *it* placed — someone standing at the
  position he asked for is left alone. Settling everyone was what made a stated
  point guard, being the tallest man there, get dragged to power forward on
  every render.
- **A drag pins the player to that spot**, and sends whoever was there back to
  the spot he came from. One drag moves exactly two people, position is never
  consulted, and nothing else on the board re-derives — a guard can be put at
  centre to see him handle a big, which is the point of dragging. Pins record
  the *spot*, not the position, so several spots can share one position and a
  drag never rewrites roster data. Pins clear on regenerate.

### Winner stays on

Two buttons record the result. Winners keep their exact roster, losers go to the
back of the line, longest waits come on as challengers. Streak shown after two.

Challengers are **not** re-balanced against the holders — that isn't the rule.
The spread reading tells you how lopsided it came out; Reshuffle is there if you
want to even it up, at the cost of breaking the chain.

### Editing is passcode-gated

Anyone can view and build teams. Changing ratings needs the shared code.

**Verification is server-side** — the cookie holds a hash of the passcode, and
`assertCanEdit()` runs inside `savePlayer` and `removePlayer` before touching the
database. A failed attempt pauses briefly to make guessing tedious. With no
`EDIT_PASSCODE` set, the app stays open.

Passcode lives in `.env.local`, which is gitignored. **It still needs setting on
Vercel before deploying.**

### Other

- Drag between teams or to the bench, with live spread
- Pairing rules (keep two together / apart)
- Share links — short id, snapshot of the teams
- Dark arena theme after NBA 2K — near-black ground, crimson accent, brushed
  steel on the wordmark, 2K's green-to-red tiers on every rating. Each sport
  still declares one accent colour and the rest derive from it, but on a dark
  ground they mix toward the page rather than toward white
- Responsive: two-pane on laptop, stacked on phone

---

## Scripts

All need env vars, which Next loads automatically but plain node does not:

```bash
# Apply a rated profile (creates the player if new)
npx dotenv -e .env.local -- node scripts/rate.mjs "Name" pg 88 84 90 86 78 82 "5'11\""

# Ratings CSV for collecting second opinions
npx dotenv -e .env.local -- node scripts/export-csv.mjs > ratings.csv

# Blind draft board — names only, shuffled. Send this BEFORE the ratings CSV
npx dotenv -e .env.local -- node scripts/draft-sheet.mjs > draft-sheet.csv

# Demo roster helpers
npx dotenv -e .env.local -- node scripts/seed.mjs [--clear]

# Sanity-check the balancer
npx tsx scripts/balance-check.ts
```

---

## Next steps

### 1. Football ratings (step 2, agreed)

The page is built; every player carries a flat 80. Needs:

- **Positions assigned.** Everyone is currently WR, which is why the page warns
  "2 teams have no quarterback" — correct behaviour, wrong data.
- **A football questionnaire.** Different from basketball: hands, speed,
  coverage, routes, IQ, throwing.
- **Who can actually throw** is the question that decides games.

Format is **5v5 two-hand touch**: QB + 3 WR + 1 TE, no offensive line.
Positions are QB / TE / WR / RUSH.

Throwing is deliberately weighted lowest (0.7) — only one player throws per
possession, so weighting it heavily would over-rate a pocket passer who can't
run or cover. Teams get a thrower through the **QB position spread** instead,
and `criticalPosition: "qb"` surfaces a warning when the group can't cover it.

### 2. Collect second opinions

Two-step, and **the order matters**:

1. **Blind draft sheet first** — names only. Showing ratings first anchors the
   answer and contaminates the most valuable feedback available.
2. **Ratings CSV second** — ask about individual attributes, especially
   rebounding, defense and athleticism.

Where three people agree against a rating, change it. Where they disagree with
each other, that player is genuinely ambiguous and the current number is fine.

### 3. Attendance-relative ranking (parked)

**Rate the player, rank the night.** Skill is absolute — Danny is a 71 whether
or not Taha shows up. What's contextual is where he falls in tonight's pool, so
the rating never moves and the board is derived live from whoever's checked in.

This is the design that keeps it clean, and it **does not depend on collecting
friends' rankings** — it reads the existing ratings. Parked by choice, not by
blocker.

One rule to preserve: the draft-round question was the *input* for setting
ratings; the board is the *output*. Feeding the board back into ratings is
circular and is how these systems drift.

### 4. Deploy

Not done, and deliberately so. Before deploying:

- Set `EDIT_PASSCODE` in Vercel project env
- Confirm the Neon integration's `DATABASE_URL` is on production
- Decide whether the link is shared as-is or gated further

---

## Decisions worth not re-litigating

- **Ratings are relative to this group.** 65 is the floor because of how it reads,
  not because of what it measures.
- **The scale can't create separation.** Gaps come from ratings, not from range.
- **Position is a preference, not a rule.** The game is positionless; the app only
  intervenes on placements anyone would object to.
- **A drag always wins** over automatic placement, and is never blocked by
  position — experimenting with mismatches is a feature, not a mistake.
- **Challengers aren't balanced** against the team holding the court. That's street
  rules, and it was a deliberate choice.
- **Height lives on the person**, not the sport profile, so it carries across sports.
- **Saved runs snapshot their teams** so old share links stay truthful as ratings change.
