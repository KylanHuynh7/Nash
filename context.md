# Nash — project context

Named for the **Nash equilibrium**: no player can improve the split by
unilaterally switching teams. That is the balancer's stopping condition, not a
metaphor — it hill-climbs swaps until none of them help. Steve Nash is the
second half of the joke.

A pickup teams app for one friend group. Store the roster once, tap who showed
up, get balanced teams. Built to kill the redundancy of re-describing fifteen
people to a chatbot every time you want to pick sides.

Two sports: **basketball** (complete) and **football** (open, playable, on
derived starting ratings). Everything is driven from one config per sport, so a
third sport is a config entry, not a new app.

**Live at https://nash-teams.vercel.app** — public, no login, works on cellular.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Styling | Tailwind v4, single dark theme per sport |
| Database | Neon Postgres via Vercel Marketplace |
| ORM | Drizzle |
| Drag & drop | `@dnd-kit/core` |
| Repo | `github.com/KylanHuynh7/Nash` (`origin/main`) |
| Hosting | Vercel — project `nash`, live at `nash-teams.vercel.app` |

Local: `npm run dev` → http://localhost:3000. On the same Wi-Fi a phone reaches
it at the Network address `next dev` prints (currently `192.168.12.176:3000` —
the router reassigns this, so re-read it rather than trusting this line).

`devIndicators: false` in `next.config.ts` — the dev-route badge sits bottom-left
over the roster and court cards, and this gets demoed off `next dev` on a phone.

### The directory was renamed

`~/Desktop/lastDance` → `~/Desktop/Nash` mid-session. Anything referring to the
old path is stale.

---

## Where things live

```
app/
  page.tsx            Landing: shield-palette shard collage, sport tiles
  [sport]/page.tsx    Server shell; loads roster + edit access
  run/[id]/page.tsx   Shared run (server component, no client bundle)
  compare/[sport]/    Pairwise comparison collector — ungated, public
  actions.ts          Server actions: roster, save/remove, runs, passcode,
                      comparisons
  globals.css         Root tokens, .figure/.metal/.eyebrow/.cut helpers
components/
  SportApp.tsx        Tabs, roster list, editor/card orchestration, sport chrome
  RunTab.tsx          Three-stage flow, generate, winner-stays-on, StageGuide
  TeamBoard.tsx       DnD context, board mutations (move / pinToSpot)
  CourtView.tsx       Court/field rendering only — placement logic lives in lib
  PlayerCard.tsx      Read-only ratings view (no passcode)
  PlayerEditor.tsx    Sliders, gated behind the passcode
  PasscodeGate.tsx    Unlock sheet
  CompareApp.tsx      The "who's better?" collector
  ShardField.tsx      Landing-page SVG backdrop
  ui.tsx              Rating, ratingTone, ratingBar, TEAM_COLORS, Button
lib/
  sports.ts           SPORTS config, computeOverall, sportChrome
  lineup.ts           buildMatchups + height settling (pure, server-safe)
  balance.ts          The balancer
  compare.ts          Pair selection: anchors, informativeness, coverage (pure)
  edit-auth.ts        Server-side passcode check
scripts/              .mts, sport-aware — see Scripts below
db/                   Drizzle schema + client
```

**`lib/lineup.ts` was extracted from `CourtView.tsx`** so the share page (a
server component) can lay out matchups without pulling a client bundle with it.
Don't move it back.

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
- **`comparisons`** — one pairwise judgement each: "who'd you rather have, A or
  B?", with the rater, the presented left/right order, and the winner (null for
  "too close to call"). Unique on `(rater, sport, axis, pair_key)` where
  `pair_key` is the two ids sorted, so nobody is counted twice on a pair. This
  is the **only rating signal in the app that did not come from one person.**

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

**Measured with PCA over the 17x6 matrix** (standardised, correlation-matrix
eigendecomposition):

```
variance explained:   73.4%  13.4%  7.4%  4.1%  1.3%  0.4%
effective dimensions: 1.77 of 6   (participation ratio)
```

One factor carries **73%**. The six attributes are, statistically, "how good is
he" plus a faint big-man/guard axis. Two consequences:

- Fitting weights *from data* is hopeless — the design matrix is near-singular,
  so coefficients would swing on noise. Don't try it.
- A one-dimensional crowd-sourced strength is a **fair** replacement for the
  overall, not a lossy one. There are not five dimensions being thrown away.

**The caveat cuts the other way too, and matters.** PCA ran on one person's
ratings, so it describes the structure of *those judgements* and cannot detect
their bias. A 0.94 correlation between shooting and finishing might be true of
basketball, or it might be halo — one rater marking good players high on
everything. A 73% first component is exactly what halo looks like. If the crowd
data comes back *less* correlated than this, that is the finding.

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

### Crowd-sourced overalls (`/compare/[sport]`)

**The problem this exists for:** every overall in the app is a weighted mean of
six attributes that one person assigned. No amount of modelling fixes that — a
model trained on those ratings relearns the same bias, because the bias is in
the labels, not in the aggregation. The only fix is a signal that did not come
from that person.

**Recording game results was considered and rejected.** The winner-stays-on
buttons are a *preview* control — people tap them to see the next matchup before
walking back on. Recording them would mix real outcomes with speculative taps
with no way to separate the two, which is worse than no data because it looks
like evidence. Do not add a `games` table until there is a deliberate
record-the-result flow that is distinct from those buttons.

**What it does instead:** asks "who'd you rather have, A or B?" and fits
Bradley-Terry to the answers. Pairwise is the right instrument because nobody
can produce a calibrated 65–99 number on a scale they didn't build, but everyone
can pick one of two names, in about four seconds.

Three bias controls, and they matter more than the model:

1. **A rating is never shown during collection.** Names only. Showing the
   current numbers anchors the answer to the opinion being checked. The current
   overall *does* steer which pair gets asked (close pairs are informative, wide
   ones are not) — that is active learning, and it never reaches the rater.
2. **A rater is never asked about themselves.** Self-assessment in a friend
   group is large and one-directional. Filtered in the picker *and* refused in
   the server action *and* re-checked in the fit — it is the one filter that
   must not silently lapse.
3. **Presented left/right order is stored**, so side preference can be measured
   rather than assumed absent.

**Anchor pairs.** Every rater is asked the same fixed set first: each player
against the one directly above him on the current ladder, plus three long-range
pairs to tie the top of the scale to the bottom. Adjacent pairs are the most
informative questions available, and asking everyone the same ones is what makes
**inter-rater agreement** measurable. With four or five raters, random selection
leaves almost no pair answered twice, and that number is the most valuable
output of the whole exercise: if the group agrees with each other far more than
they agree with the stored ratings, the stored ratings are the outlier.

**How many raters.** Four is enough to start and it is the big jump — error from
one rater to four falls by roughly half (as √n); 4→8 takes off only another 29%.
Two things four cannot do: correlated bias (everyone sharing a blind spot) never
averages out at any n, and down-weighting a careless rater needs a consensus to
measure them against, which wants 6+.

`SESSION_TARGET` is 60, capped at `availablePairs` — football's twelve-man
roster leaves a rater 55 pairs, and a bar counting to 60 would never fill.
Progress counts a rater's **lifetime** answers, not the sitting's, so someone
returning is not told they have done none of it.

### The three-stage flow

1. **Who showed up** — from the whole pool
2. **On the court/field** — from those present, chosen by hand or by **Auto-pick**,
   which gives the floor to whoever has waited longest
3. **Generate** — teams built from the on-court set only

The app used to choose who sits. It doesn't any more — that's the user's call,
and auto-pick is a convenience rather than a rule. Waiting players carry a badge
showing how many games they've sat.

Before teams exist, the second column shows the three stages and where you are
(`StageGuide` in `RunTab.tsx`). It used to be an empty dashed box taking 400px of
every laptop load.

### Court / field view

Both teams stacked at each of five spots, so a game reads as five matchups
rather than two lists. **Two teams with identical averages can still be lopsided
at three positions, and only this view shows that.**

The advantage delta carries **three independent signals** so it can't be read
backwards: it sits on the row of the player who holds it, renders in that team's
colour, and the bar underneath names the team outright.

**Placement rules** (`lib/lineup.ts`):
- Stated position first; leftovers fill open spots
- A spot may name the `position` that claims it, so several spots can share one
  — football's three receiver spots are all `wr`. Defaults to the spot's own key,
  which is why basketball never states it.
- A **height-settling pass** stops a 5'5" guard landing at centre, with a **3"
  tolerance**. It only ever moves a player *it* placed — someone standing at the
  position he asked for is left alone. Settling everyone was what made a stated
  point guard, being the tallest man there, get dragged to power forward on
  every render.
- **A drag pins the player to that spot**, and sends whoever was there back to
  the spot he came from. One drag moves exactly two people, position is never
  consulted, and nothing else on the board re-derives — a guard can be put at
  centre to see him handle a big, which is the point of dragging. Pins record
  the *spot*, not the position, so a drag never rewrites roster data. Pins clear
  on regenerate.

### Winner stays on

Two buttons record the result. Winners keep their exact roster, losers go to the
back of the line, longest waits come on as challengers. Streak shown after two.

Challengers are **not** re-balanced against the holders — that isn't the rule.
The spread reading tells you how lopsided it came out; Reshuffle is there if you
want to even it up, at the cost of breaking the chain.

### Viewing vs editing

Tapping a roster name opens **`PlayerCard`** — all attributes with bars, weights,
hints, rank in the group, best/weakest flags. **No passcode.** Looking at a
rating is the common case; the gate belongs on changing one, so "Edit ratings"
inside the card is the only thing that asks.

Attributes sort by **weight**, not config order — that's the order the overall
actually cares about. Bars fill across **65–99, not 0–99**, or the floor of the
group renders as "66% good".

**Verification is server-side** — the cookie holds a hash of the passcode, and
`assertCanEdit()` runs inside `savePlayer` and `removePlayer` before touching the
database. A failed attempt pauses briefly to make guessing tedious. With no
`EDIT_PASSCODE` set, the app stays open.

Passcode lives in `.env.local`, which is gitignored. **It still needs setting on
Vercel before deploying.**

### Share links

Short id, snapshot of the teams. The share page derives its chrome from the
sport, colours ratings on the same tier scale, and **rebuilds the head-to-head
matchups from the snapshot's positions** — it used to show two flat lists, which
loses the whole point of the court view. A real example: spread 0.0, both sides
averaging 78.2, and Red +20 at power forward against Blue +17 at point guard.

A **team average never gets the rating badge** — tiering a mean on the player
scale made an even 78 render amber, reading as "weak team" when both sides were
identical.

---

## Design system

### A sport owns its whole chrome

`sportChrome(config)` in `lib/sports.ts` derives **every** CSS variable from the
sport's one declared accent — surfaces, borders, text, page gradient. Used by
`SportApp` and the share page, so a link out of basketball still looks like
basketball. Basketball is `#e01e37`, football `#16a34a` (placeholder until its
Madden palette is picked).

Two rules learned the hard way:

- **The accent is a hint in surfaces, not a wash.** Tinting every panel heavily
  left the ground and the cards at the same value, so nothing read as a card and
  the page looked unfinished. Panels step up in brightness; the accent goes where
  it means something — header, active tab, primary button, deltas.
- **The sport paints its own fixed viewport layer.** `body` reads its gradient
  from `:root`, so without that the football page sat on a red ground.

The page gradient is **contained to the top**, like a light over the near end of
the court. Below the fold it is simply dark, which is what gives panels something
to sit on.

### Ratings

2K's tier colours: emerald 90+, lime 80s, amber 70s, orange high 60s, red at the
floor. `ratingTone()` for badges (a 15% wash so the number stays readable on
top); **`ratingBar()` for bars** — solid fills, because a bar has nothing on top
of it and the wash was nearly invisible.

Teams are **red and blue**, home and away.

### Landing page (`ShardField.tsx`)

White-blue-red only — the NBA/NFL shield palette. A sport's own colour belongs
to its own page. Composed after the 2K covers: one plane, broken.

Five attempts. The first three are kept because each names a trap, but **the
current design contradicts two of them on purpose** — read to the end before
reviving any of it.

1. **Independently placed rectangles read as confetti**, not shatter, however
   many you scatter. Neighbouring fragments have to share edges.
2. Attempt 1's fix was to draw the fractures *last*, as continuous white slivers
   cutting every colour underneath. Those had to be **opaque** — a translucent
   sliver reads as tape laid over the art rather than a break in it.
3. **Two perpendicular families of cracks spanning edge to edge read as plaid.**
   They were fanned from two off-canvas impacts, some stopping partway.

Then, reviewed against the 2K22 cover, two things were wrong:

4. **The white slivers broke the palette.** The shield is red, white and blue,
   so drawn white reads as a fourth element competing with the ground rather
   than as the ground. They are gone. Shared edges now come from bands being
   **flush** — one band's edge *is* its neighbour's — which satisfies finding 1
   without drawing anything. **Don't reintroduce the cracks to fix confetti;
   tile the bands instead.**
5. **The two masses leaned against each other to "collide"**, which read as a
   chevron aimed at the middle. **Every long edge now leans the same way — a
   `\`, down and to the right.** One lean, the whole canvas, both breakpoints.

The rule that replaced "neither colour keeps to its own half": **a colour stays
in its own territory, and the clash lives at the border.** Opposing-colour
fragments are only ever taken from the **two innermost bands** — the ones
against the white corridor. A red wedge stranded at the far left of the blue
field reads as a stray, not as a collision.

**Pure white was the actual problem, not the corridor's width.** The mass used
to end on `BLUE_PALE`/`RED_PALE` and then jump straight to `#ffffff`, so the
ground read as a wall rather than as the same plane continuing — and against
maximum contrast, every fragment near the border looked misplaced no matter
where it sat. Each mass now **ramps into the ground** through two near-white
steps (`*_MIST`, `*_HAZE`), and the ground itself is `#f3f6fb` rather than pure
white, which was the brightest thing on the page by some margin.

The ramp is also what narrowed the empty middle. **Moving the hard boundaries
inward was not available**: content measures **x 48–112, y 29.7–67.9** in wide
viewBox units (measured, not eyeballed — `getClientRects` on the text nodes,
since the block boxes are full-width and useless here), and at this lean the
walls already sit within a unit or two of the cards. The haze steps can cross
that line because they're faint enough to pass behind a dark card invisibly.
If the corridor ever needs to narrow further, add ramp steps — don't move the
walls, and don't reduce the lean either: a smaller lean buys room on the blue
side and gives the same amount back on the red.

Fragments are **band-aligned and opaque**. A fragment replaces a *segment of a
band*, so its long edges are that band's own edges and only its end cuts are
free (`skew` offsets them so the breaks aren't level). Edges that cut *across*
band boundaries, or any translucency, make the fragment read as a pane laid on
top of the plane instead of a break in it — that was the first thing wrong with
attempt 4.

**Two compositions swapped at the breakpoint:** vertical bands eat the whole
width of a phone and leave nothing to put words on, so on mobile they run
horizontally and crowd the top and bottom. Both keep the middle clear. On the
tall composition the same `\` means the **right end of each band sits lower**.

Geometry is generated, not hand-written: `wx`/`ty` place a line, `wideBand`/
`tallBand` fill between two of them, `wideShard`/`tallShard` cut a segment out.
Editing the composition means changing numbers in the band lists, not polygon
strings — the old version's hand-tuned `points` were the reason the lean was
inconsistent in the first place.

### Sport backdrop (`SportShards.tsx`)

The sport page's ground is **brushed silver with the plane shattered at the
centre** — not the old dark red radial wash, which read as a blur rather than a
surface.

Different construction from `ShardField`, because it wants a different thing.
ShardField breaks a plane into parallel bands: orderly, one lean, a fault line.
This is an **impact** — shards radiate from a centre and are meant to look
chaotic.

Chaos and connectedness pull against each other. Scattering independent polygons
gives chaos and loses the connection: confetti, with silver showing through the
gaps. So the field is a **web, not a pile** — rays at uneven angles, rings at
uneven radii, each shard the quad between two neighbouring rays and two
neighbouring rings. Neighbours are cut from the *same corner points*, so every
edge is shared exactly and the mass is one shattered pane, while the jitter means
no edge stays straight for long.

Three rules that are not free to change:

1. **The noise hash must be integer-only.** `Math.sin` — the usual one-line hash
   noise — is not required by ECMAScript to be identical across implementations.
   Node's V8 and the browser's diverge in the last bits, which is enough to move
   a shard and produce a **hydration mismatch**. It uses `Math.imul`, and
   geometry is rounded via `toFixed(3)` before being stringified.
2. **A phone gets its own field.** `slice` scales to cover, so on a 390px-wide
   phone the 160-unit field is drawn ~1350 units across and clipped to its middle
   sliver — precisely where every ray converges. It read as a pinwheel. There are
   separate `WIDE` and `TALL` geometries.
3. **The mass is veiled to 0.55.** It sits directly behind the content column,
   and at full strength its black facets and the page's dark ink cancel out —
   labels like the spread disappear. **This is a real tradeoff**: the shards are
   calmer than the 2K reference. The alternative, if punch is wanted back, is to
   move the mass down-right so it sits behind the dark cards instead of under the
   text.

#### Text on the silver

`--foreground` and `--muted` are tuned for dark cards and vanish on silver. Text
that sits **directly on the ground** uses `--ink` / `--ink-soft` instead. The
same applies to the accent: full-strength green on silver reads at about 2.6:1,
so on-ground accent controls use `--accent-ink` (the accent mixed 72% into
near-black). `.metal` is dark brushed steel now, and `.eyebrow` is `--ink-soft`.

`body` is a plain neutral `#eceef2` and **must not carry a contrasting colour**.
Every page paints its own ground in a fixed layer on top; when body carried
Nash's navy, any frame where that layer was not painted flashed navy through.

### Mobile

Verified at 390×844 across landing, run tab, roster, player card, court view and
share page: **no horizontal overflow anywhere**, court fits with all five matchup
cards readable, share page stacks.

Two notes for whoever tests next:

- A fullPage screenshot shows a false seam where the `fixed` background layer
  ends. Scroll a real viewport before believing it.
- **Arbitrary Tailwind values can silently fail.** `text-[3.75rem]` did not
  generate and the wordmark rendered at 16px on phones — invisible on desktop
  because the `sm:` variant was fine. Measure computed styles, don't eyeball.

---

## Scripts

All are `.mts` (run with `tsx`) and **sport-aware** — they read attributes,
weights, positions and the scale from `lib/sports.ts`, so adding a sport there is
enough. They need env vars, which Next loads automatically but node does not.

```bash
# Apply one rated profile (creates the player if new). Attributes are NAMED,
# not positional — entering six numbers in config order 17 times is where a
# silent transposition hides.
npx dotenv -e .env.local -- npx tsx scripts/rate.mts basketball "Victor" pg \
  shooting=87 finishing=84 playmaking=88 defense=87 rebounding=79 \
  athleticism=84 height=5'11"

# Apply a whole roster from CSV (header names the columns)
npx dotenv -e .env.local -- npx tsx scripts/rate.mts football --file ratings.csv

# Ratings CSV for second opinions. Output is valid `rate --file` input, so a
# marked-up sheet feeds straight back.
npx dotenv -e .env.local -- npx tsx scripts/export-csv.mts basketball > ratings.csv

# Blind draft board — names only, shuffled. Send BEFORE the ratings CSV.
npx dotenv -e .env.local -- npx tsx scripts/draft-sheet.mts basketball > draft-sheet.csv

# Demo roster helpers (still .mjs, basketball-only)
npx dotenv -e .env.local -- node scripts/seed.mjs [--clear]

# Delete one sitting's comparisons — a rushed run-through, or a demo.
# Prints what it will remove before removing it. Scoped to one session on
# purpose; there is no "delete all" by design, because every environment
# shares one DATABASE_URL and a delete here is a delete in production.
npx dotenv -e .env.local -- npx tsx scripts/drop-session.mts <sessionId>

# Fit Bradley-Terry to the collected comparisons and propose overalls.
# Writes nothing — it prints, a person applies.
npx dotenv -e .env.local -- npx tsx scripts/fit-bt.mts basketball
npx dotenv -e .env.local -- npx tsx scripts/fit-bt.mts football --lambda 2

# Sanity-check the balancer
npx tsx scripts/balance-check.ts
```

Out-of-scale values are **rejected, not clamped** — a 45 is a mistake about the
scale, and quietly rewriting it to 65 hides that. Height only writes when given,
so a football entry can't blank a height set from basketball.

Round-trip verified: export all 17 basketball profiles → re-apply → re-export is
byte-identical.

---

## Deployment

**https://nash-teams.vercel.app** — production, public, passcode-gated for edits.

The Vercel project was renamed `run-it-back` → `nash`. `nash.vercel.app` is
taken by someone else, hence the suffix. `run-it-back-amber.vercel.app` still
resolves, so older links survive.

Two things to know before touching hosting:

- **`vercel alias set` pins to one build.** It does *not* follow later
  production deploys — verified by deploying twice and watching the alias stay
  on the old build. `nash-teams` is registered as a **project domain**
  (`vercel domains add nash-teams.vercel.app nash`), which does follow.
- **Vercel Authentication was on** (`ssoProtection: all_except_custom_domains`)
  and would have bounced every friend to a Vercel login. It is off. If a future
  project looks unreachable to outsiders, check this first.

`EDIT_PASSCODE` is set in Production **as a Secret** — write-only, so
`vercel env pull` cannot read it back. The local `.env.local` is the only
readable copy. Without it the app **fails open** (`lib/edit-auth.ts:32`).

All environments share one `DATABASE_URL`. There is no separate production
database: local dev writes are what everyone sees live.

---

## Next steps

### 0. Where the last session left off — start here

**Crowd-sourced ratings and tap-to-swap are built, committed (`4c42dfe`), and
live in production.** `npm run build` and `eslint` are clean.

#### The table is clean

Three browser-test rows recorded under Kylan's name were deleted on
2026-08-28 (`drop-session.mts 7larewtl`). **`comparisons` is empty** — the
first real answer will be the first row in it.

If test rows ever get in again, `scripts/drop-session.mts <sessionId>` removes
one sitting and prints what it is about to delete first.

#### Send the link

**https://nash-teams.vercel.app/compare/basketball** — to four or five people.
Football is at `/compare/football` and works, but send one axis at a time.

Nothing downstream can be evaluated until real answers exist. The pipeline is
verified end to end against four simulated raters (240 comparisons): injected
biases of −8, −5 and +6 came back as −8, −4 and +4, the attenuation being the
ridge shrinkage working. Those simulated rows were deleted.

#### What this collection is actually for — the goal was re-labelled

**Not** "make the friend group's ratings accurate." That is a dead end: the
spread is already 0.0, and the top five and bottom five never move no matter
what. Getting one player from 79 to 71 improves nobody's game.

**It is the first real user test of the public product's onboarding.** The
hardest problem in the general version is cold start — a new group cannot
produce attribute ratings, and no stranger will move six sliders fifteen times.
Pairwise tapping is the only onboarding a new group will finish, so what is
being measured here is:

- Do people finish 60 taps, or bail at 15?
- How long does it actually take against the ~4 min estimate?
- Is inter-rater agreement interpretable at n=4, or is it noise?

If four friends who like you don't finish, no stranger will. **That is the
finding worth having before building multi-tenancy**, and it costs only the
sending of a link that is already deployed.

**So do not tune the fit further for this group.** No second axis, no attribute
refinement, no `throwing` pass. Run `fit-bt.mts` once to confirm it works on
real data, then move to the general-use plumbing below. Those are friend-group
depth, and depth is not what the project needs next.

#### Can the rater vote in his own collection?

Yes — pick "Kylan" and it behaves normally; self-comparisons are excluded. Two
things to know:

- **It partially double-counts him.** His opinion is already the shrinkage prior
  in `fit-bt.mts`, so adding him as a rater counts him twice. Either drop his
  rater rows before fitting, or lower `--lambda` to weaken the prior.
- **It produces a genuinely interesting number.** The fit's "vs current" column
  for him is a **test-retest reliability** check: how often his four-second gut
  disagrees with his own stored ratings. A high disagreement rate would put a
  ceiling on how meaningful the stored ratings are at all — a more important
  finding than any individual rating change.

#### Deployment gotcha found this session

**The Vercel project is not connected to GitHub.** Every deployment in the
history was made from the CLI. `git push` deploys *nothing* — production sat on
a five-minute 404 until `vercel deploy --prod` was run by hand. Either keep
deploying manually or connect the repo in the Vercel dashboard once.

The `comparisons` table already existed in production before the code shipped,
because all environments share one `DATABASE_URL`. That is also why
`drop-session.mts` has no unscoped delete.

Still open and deliberately untouched:

- The **wordmark underline** (`app/page.tsx`) still has a hand-set angle.
- **Football's accent is still the placeholder `#16a34a`.**
- **Cross-team and bench tap-swaps** — see §2.
- **`throwing` is still flat 75 for all twelve football players.**

### Longer term: this is meant to generalise

The aim is a public app any group can use. **The friend group is a testbed and a
running joke, not the product** — the point of rating these seventeen was to get
a framework working and to wind people up about their numbers.

**The collector is the general-use path, not a detour from it.** Current
onboarding asks one person to rate fifteen people across six attributes; no new
group will ever do that. Three minutes of "who's better" is an onboarding a
group actually completes, and it produces overalls with **no expert rater at
all**. That is a real answer to cold start, and it is why the de-biasing work
and the generalisation work are the same work right now.

#### The inversion

Today: **attributes are primary**, overall is derived from them.
Public: **overall is primary** (crowd-fitted), attributes become optional —
added later by groups that care, only to drive position placement and
`throwing`. PCA says the six attributes carry ~1.8 dimensions between them, so
little is lost by not asking for them up front.

#### What onboarding looks like

1. One person creates a group and types in names. Two minutes, unavoidable.
2. Shares the invite link. Everyone taps for three minutes.
3. Overalls come out of Bradley-Terry. **No rating session ever happens.**

The invite link *is* the product loop: create, share, tap, teams exist.

#### Known work, none of it started

- **A groups/tenant concept.** `comparisons.rater_id` references `players` and
  assumes the rater is on the roster — true for one group, false for a public
  app. Every query needs per-group scoping.
- **Real accounts**, replacing the single shared `EDIT_PASSCODE`.
- **Cold-start pair selection.** `informativeness()` in `lib/compare.ts` reads
  current overalls to find close pairs. A brand-new group has none, so the first
  pass must fall back to uniform-plus-coverage and only go adaptive once
  estimates form. Small change, but it will surprise whoever hits it.
- **Mapping BT output onto 65–99 without a prior.** `fit-bt.mts` currently
  centres on the existing mean overall; a new group has no mean to centre on, so
  the latent scale needs a rank- or quantile-based map instead.

**The trap to avoid:** building groups, accounts and scoping for a flow nobody
has ever completed. Watch the friend group finish (or not) first — that is what
§0 is for.

### 1. Football — where it stands

**Roster: twelve.** Taha, Bang, Brendan, Eric and David were removed — never
played football with the group. Their football profiles are deleted, not left
rated. Twelve is a clean 5v5 with two rotating.

| Position | Players |
|---|---|
| WR | Orion, Victor, Rayan, Brian, Kylan, Lucas |
| TE | Joe, Jason, Sean, Alfonso |
| SLOT | Danny, Justin |

**The ratings are derived, not judged.** Football shares no attributes with
basketball, so each football skill was mapped onto the basketball skill that
most nearly demands the same thing:

| Football | From |
|---|---|
| `speed` | `athleticism`, outright — the same trait |
| `coverage` | `defense` — staying with a man |
| `hands` | 60% `finishing`, 40% `rebounding` — catching in traffic |
| `routes` | 60% `playmaking`, 40% `athleticism` |
| `iq` | 60% `playmaking`, 40% `defense` — reads and spacing |
| `throwing` | **nothing.** Flat 75. No basketball skill implies an arm. |

`football-ratings.csv` records exactly what went in. These are a floor to
correct from in the editor, not numbers anyone should trust. Because `throwing`
is uniform it distorts nobody *relative* to anyone else — it just does nothing.

#### The football position model

This changed twice, and both wrong turns are worth knowing so they aren't
retaken.

**First wrong turn:** a first pass at the roster read as twelve receivers, and
tight end and slot were being stripped out of the config as positions nobody
holds. They *are* held — the list was generalising. Reverted before it shipped.

**Second wrong turn:** QB/WR players were modelled as a primary position plus an
`also_plays` array, with the balancer guaranteeing each side held a QB. A column
was added and dropped again within the hour.

**What it actually is:** the group doesn't designate a quarterback. A side rides
whoever has the hot hand and switches at will. So the question was never *who is
the QB* but *who is our best QB right now*. That makes QB a **role the team
elects into**, not a position anyone is.

So QB is a **spot**, not a position, and it is filled from an attribute:

- `SportConfig.decisiveAttribute` — the one attribute where a team's *best*
  matters more than its average. Football names `throwing`.
- A spot can carry `byAttribute`. Football's QB spot carries `throwing`.
- `buildMatchups` fills attribute-claimed spots **first, and to the team's
  best**. It has to run before position matching, or the arm is already placed
  out wide and the spot goes to whoever was left over.
- `cost()` in the balancer scores the decisive attribute on each team's **best**
  rather than its average. Averaging it is wrong twice over: only one person
  throws, so four low numbers say nothing about how a side plays; and two teams
  can average identically while one holds the only real arm.

Measured over eight seeds with three throwers at 92/88/84: best-arm gap is **4
every time** with the term, **4 or 8 without it** — 8 being both good arms
stacked on one side.

`criticalPosition` still exists in `SportConfig` and no sport sets it. It is a
working config option, kept because adding a sport is meant to be config only.

#### Position questionnaires — open question

The user asked whether to run a questionnaire per position, and whether that is
too much for twelve players. Two things bear on it:

- **`throwing` is the one that genuinely needs asking.** Everything else has a
  derived starting point; that column is empty. It is also now load-bearing —
  it decides who plays quarterback and it is scored on team bests.
- **A "QB overall" was raised** — how good someone is *as a quarterback*, as
  distinct from their receiver overall. That is a derived figure (throwing +
  iq, weighted), not a new stored attribute, and it would give the field view
  something honest to show at the QB spot.

### 2. Tap-to-swap — built (same-team only)

Tap a player on the court, his own team's spots outline in dashes, tap one to
swap. Both inputs drive the same reducer: `pinToSpot` already performed exactly
this swap for drag, so this is a UI layer over logic that was already written.

- Selected: solid 2px accent ring. Targets: 1px **dashed outline**.
- **An empty spot is a valid target** ("move here") — nobody is displaced.
- **Only the selected player's own side lights up.** A cross-team swap changes
  who is on which side, which `pinToSpot` does not do.
- Starting a drag clears a pending selection, or the drop lands and the click
  that follows it swaps a second pair.
- A selection pointing at a lineup that no longer exists is dropped on every
  render (`selectionLive` in `TeamBoard.tsx`), so a regenerate can't leave the
  wrong slot lit.

**Position is not consulted**, matching drag. `context.md` previously said
targets must be position-aware in football, but that contradicts the standing
decision that a drag is never blocked by position — and tap and drag doing
different things on the same elements would be worse than either rule.

**Still not built: cross-team and bench swaps.** Those need a real `swap`
reducer; `move` relocates one player and changes team sizes, which is not a
swap. Estimated ~1–1.5 hr.

**Not yet tested under a real thumb.** Sensors use an 8px distance threshold and
a 180ms touch delay, and dnd-kit suppresses the click that would follow a drag —
verified in a headless browser, which is not the same as a phone.

### 2b. Collect second opinions — superseded by `/compare`

The two-step CSV plan (blind draft sheet, then marked-up ratings CSV) is
replaced by the comparison collector, which is strictly better on every axis
that mattered: it is anchor-free by construction, it is three minutes on a phone
rather than a spreadsheet, and it produces data a model can actually fit.

`draft-sheet.mts` and `export-csv.mts` still work and are still the right tools
for a *targeted* question about one attribute.

**The next action is not code.** Send `/compare/basketball` to the four friends
who will answer. Nothing downstream can be evaluated until real answers exist,
and the fit script's own output is what says whether the ratings need to move.

**Football wants this more than basketball, not less.** Its numbers are not even
judgements — they are a documented transformation of basketball ratings, so they
have a *weaker* claim to accuracy. `/compare/football` works today.

**`throwing` is the one thing a second axis is genuinely needed for.** It is
flat 75 for all twelve, it decides who plays quarterback, and it is scored on
team maxima — so it is load-bearing and contains no information at all. "Who'd
you rather have throwing the ball?" is the obvious second axis, and the `axis`
column exists for it. Add it only after the overall pass gets finished; asking
for two passes up front is how you get neither.

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

### 4. Deploy — done

See **Deployment** above. Live at https://nash-teams.vercel.app, public, with
editing passcode-gated in production.

### 5. Tests (not started, worth doing)

Several throwaway verification scripts were written and deleted across sessions:
placement/drag correctness, the two-player swap, the CSV round-trip. A balancer
with a measured spread of 0.0 and no test asserting it is a claim, not evidence.
The material already exists.

---

## Bugs found and fixed (don't reintroduce)

- **`settleByHeight` ran on everyone**, not just players it placed. With nobody
  dragged, 3 of 5 players sat at the wrong spot and a stated PG who was tallest
  got pulled to PF every render.
- **A drop wrote the spot key into `position`.** Survivable in basketball where
  the keys match; on football it set `position = "wr_l"` and `saveRun` snapshots
  it, so a saved run would render the raw key forever. Dropping on the *right*
  receiver spot also placed the player left.
- **Football positions matched no field spot** — every WR fell through to
  spillover and got placed by height alone, silently contradicting "stated
  position first".
- **The rating scripts were basketball-only**, hardcoding the six keys, the
  weights and `sport='basketball'`. There was no way to write a football rating.
- **The share page had drifted three ways**: wrong palette, no rating tiers, and
  two flat lists instead of the head-to-head.
- **`text-[3.75rem]` silently did not generate**, rendering the mobile wordmark
  at 16px.
- **`Math.sin` noise caused a hydration mismatch.** Server and client computed
  marginally different shard coordinates. Fixed with `Math.imul` and rounded
  geometry. Any generated art in a server-rendered component has this hazard.
- **The "crash" on Generate was a navy flash**, not a crash. `body` painted
  Nash's navy under every page while each page painted its own ground on top;
  any frame the top layer was missing showed navy. Ruled out on the way: the
  balancer runs in 37–69ms, `saveRun` is not passcode-gated, and neither desktop
  nor mobile produced a single console error.
- **A height of `5'10"` broke the ratings CSV.** The double quote is a field
  delimiter to the RFC-4180 reader in `rate.mts`, shifting every column after
  it. It surfaced as `missing hands` — several columns from the cause. Heights
  go into the CSV as **plain inches**.
- **The sit-out badge was `bg-amber-100` under `text-amber-300`** — cream on
  light amber, a light-theme leftover. Two warning notices had the same problem.
- **`ring-dashed` is not a Tailwind utility** and failed silently — rings are
  box-shadows and cannot be dashed. `outline-dashed` is the real one. Same class
  of trap as `text-[3.75rem]`: verified by reading `getComputedStyle`, not by
  looking at it.
- **`drizzle-kit push` offered to truncate `profiles`** to add a unique
  constraint that was *already present* in the database. The comparisons table
  was created with explicit SQL instead. Check `pg_constraint` before believing
  drizzle-kit about drift, and never accept a truncate prompt on this database —
  local dev writes are production.
- **The sport backdrop needed a `veil` prop.** 0.55 was tuned against pages full
  of cards; on the sparse compare page the facets sat bare behind the type. The
  default is unchanged; `/compare` passes 0.3.
- **`vercel alias set` does not follow later deploys.** See Deployment.

---

## Decisions worth not re-litigating

- **Ratings are relative to this group.** 65 is the floor because of how it reads,
  not because of what it measures.
- **The scale can't create separation.** Gaps come from ratings, not from range.
- **Position is a preference, not a rule.** The game is positionless; the app only
  intervenes on placements anyone would object to.
- **Football has no quarterback position.** The group rides a hot hand and
  switches at will, so QB is a role a side elects into, not a thing anyone is.
  It is a spot filled from `throwing` via `byAttribute`. Modelling it as a
  position was tried — with an `also_plays` column — and rejected.
- **A team's best matters more than its average, for one named attribute.**
  Only one person throws; four low numbers say nothing about how a side plays.
  `decisiveAttribute` exists for exactly this and is scored on team maxima.
- **Derived ratings are a floor, not a judgement.** Football's numbers come from
  basketball via a documented mapping. `throwing` has no analogue and is left
  flat rather than invented.
- **A drag always wins** over automatic placement, and is never blocked by
  position — experimenting with mismatches is a feature, not a mistake.
- **Challengers aren't balanced** against the team holding the court. That's street
  rules, and it was a deliberate choice.
- **Height lives on the person**, not the sport profile, so it carries across sports.
- **Saved runs snapshot their teams** so old share links stay truthful as ratings
  change.
- **Viewing a rating is free; changing one is gated.** The comparison collector
  is the deliberate exception: a passcode on the one page that gathers other
  people's opinions would defeat its whole purpose.
- **The bias is in the labels, not the aggregation.** No model trained on the
  stored ratings can remove it. Only an independent signal can, which is what
  `/compare` collects.
- **Overalls may become crowd-derived; attributes stay one person's.** Overall
  is what the balancer uses, so that is the number worth de-biasing. Attributes
  are descriptive — the player card, position placement, `throwing` for the QB
  spot — and PCA says they carry ~1.8 dimensions between them anyway.
- **The preview win buttons are not results.** People tap them speculatively.
  Recording them would be noise wearing the costume of evidence.
- **The fit proposes; a person applies.** A model that edits the roster on its
  own is a model nobody checks.
- **The friend group is a testbed, not the product.** Chasing rating accuracy
  for these seventeen is a dead end — the spread is already 0.0 and the ends of
  the ladder never move. The collection's value is proving the *onboarding*
  works, because that is the public app's hardest problem.
- **Deploys are manual.** The Vercel project is not connected to GitHub; a push
  ships nothing.
- **Red and black belong to basketball**, green to football, white-blue-red to
  Nash itself. A sport's palette is derived from its accent, never hardcoded.
- **The landing plane leans one way (`\`) and no white is ever drawn into it.**
  Both were tried the other way and rejected on review, not in the abstract.
