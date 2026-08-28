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
| Styling | Tailwind v4, single dark theme per sport |
| Database | Neon Postgres via Vercel Marketplace |
| ORM | Drizzle |
| Drag & drop | `@dnd-kit/core` |
| Repo | `github.com/KylanHuynh7/Nash` (`origin/main`) |
| Hosting | Vercel — project `run-it-back`, **not yet deployed** |

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
  actions.ts          Server actions: roster, save/remove, runs, passcode
  globals.css         Root tokens, .figure/.metal/.eyebrow/.cut helpers
components/
  SportApp.tsx        Tabs, roster list, editor/card orchestration, sport chrome
  RunTab.tsx          Three-stage flow, generate, winner-stays-on, StageGuide
  TeamBoard.tsx       DnD context, board mutations (move / pinToSpot)
  CourtView.tsx       Court/field rendering only — placement logic lives in lib
  PlayerCard.tsx      Read-only ratings view (no passcode)
  PlayerEditor.tsx    Sliders, gated behind the passcode
  PasscodeGate.tsx    Unlock sheet
  ShardField.tsx      Landing-page SVG backdrop
  ui.tsx              Rating, ratingTone, ratingBar, TEAM_COLORS, Button
lib/
  sports.ts           SPORTS config, computeOverall, sportChrome
  lineup.ts           buildMatchups + height settling (pure, server-safe)
  balance.ts          The balancer
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

# Sanity-check the balancer
npx tsx scripts/balance-check.ts
```

Out-of-scale values are **rejected, not clamped** — a 45 is a mistake about the
scale, and quietly rewriting it to 65 hides that. Height only writes when given,
so a football entry can't blank a height set from basketball.

Round-trip verified: export all 17 basketball profiles → re-apply → re-export is
byte-identical.

---

## Next steps

### 0. Where the last session left off — start here

**Landing design is settled and merged** (`228bc8f` on `main`). It was reviewed
against the 2K22 cover and reworked three ways: white slivers removed, one
consistent `\` lean, colour kept in its own territory with the clash at the
border, then the masses ramped into a near-white ground. The full reasoning and
the rules that replaced the old ones are under **Landing page** above — read that
before touching `ShardField.tsx`, because two of the older findings there are
contradicted on purpose.

**Football ratings are the next task and they are blocked on one thing: Q0.**
The questionnaire (below, now recorded verbatim) was put to the user and Q0 —
the 1-to-17 draft order — was not yet answered. Nothing else can start: the
ladder sets the bands, and the attribute answers are shaped within the slot the
ladder assigns. Ask for Q0 on its own, wait for it, then send the ten.

Two design items were noticed during review and deliberately **not** changed,
since neither was raised:

- The **wordmark underline** (`app/page.tsx`) still has a hand-set angle on its
  red/blue split bar — the last element on the landing page with a slant that
  isn't derived from the shard field's lean constant.
- **Football's accent is still the placeholder `#16a34a`.** The Madden palette
  was never picked. Worth settling before football ratings land, because the
  whole football chrome derives from that one value.

### 1. Football ratings — the actual next task

The page is built; every player carries a flat 80 and everyone is `wr`.

Format is **5v5 two-hand touch**, positions **QB / TE / WR / SLOT**. There is no
run game and no designated rusher — `rush` was removed. The slot is the closest
thing to a back (short routes run as if he came out of the backfield), which
makes it a role of its own rather than a third receiver.

Throwing is deliberately weighted lowest (0.7) — only one player throws per
possession, so weighting it heavily would over-rate a pocket passer who can't
run or cover. Teams get a thrower through the **QB position spread** instead,
and `criticalPosition: "qb"` surfaces a warning when the group can't cover it.

**The questionnaire is written and is now recorded here verbatim.** It was
previously kept in chat only, on the reasoning that it didn't need to be a file.
That cost a whole regeneration a session later, and a regenerated questionnaire
is a *different* questionnaire — the wording is the instrument, so redrafting it
silently changes what the ratings mean. It lives here now.

Same three-pass method as basketball. Q0 is the anchor — "what round does
he go in a 5v5 football draft" — answered for all 17 *before* anything else,
because basketball order is not football order. Then ten behavioural questions,
four of the six attributes getting a primary question that sets a band plus a
second that adjusts it:

| | Primary | Adjuster |
|---|---|---|
| Throwing ·0.70 | QB rolls an ankle — how do you feel? | — |
| Hands ·1.15 | Wide open, does it stick? | Contested catch in the endzone |
| Speed ·1.10 | Where does he finish in a 40? | Can he actually get behind people? |
| Routes ·1.05 | Open in three yards, or needs the play to break? | Catch-and-go on the short route |
| Coverage ·1.10 | Who guards their best guy? | Has he taken the ball away? |
| IQ ·0.90 | Scramble drill + does he know who he has? | — |

Bands: 93–99 best here, 85–92 clearly above, 76–84 average, 69–75 below but
functional, 65–68 floor.

**Q0 — the anchor.** "It's a 5v5 two-hand touch draft. What round does he go?"
A straight 1-to-17, no ties. Not "how good is he at football" — who you'd
actually take, knowing four of your five have to catch and cover. Answer for all
17 before reading anything below; the attribute questions anchor you if seen
first.

**The ten.** Answered by naming players, not by scoring them — names are more
reliably given than numbers.

1. *Throwing* — Your QB rolls an ankle. How do you feel about each of the rest
   taking over? Who's an actual thrower, who's a "we'll survive", who can't?
2. *Hands, primary* — He's wide open, ball hits him in the chest. Does it stick?
   Who drops those?
3. *Hands, adjuster* — Endzone, corner draped on him, ball's up. Who comes down
   with it?
4. *Speed, primary* — All 17 line up for a 40. Roughly where does each finish?
5. *Speed, adjuster* — Can he actually get behind people in a game? Some are
   fast in a straight line and never separate.
6. *Routes, primary* — Does he get open within three yards of the line, or does
   he need the play to break down first?
7. *Routes, adjuster* — Short route, catch-and-go. Who turns five yards into
   fifteen?
8. *Coverage, primary* — Their best guy is lined up. Who do you put on him? And
   who do you hide?
9. *Coverage, adjuster* — Has he actually taken the ball away? Picks, swats,
   breaking on the ball.
10. *IQ* — Scramble drill: QB breaks the pocket, does he work back to him or
    stand where the route ended? On defense, does he know who he has, or is he
    chasing the ball?

Positions come out of the answers, not preference: **QB** from the throwing
question, **TE** from height + contested catch, **WR** from the speed pair,
**SLOT** from the short-route question.

The contested-catch question is answered about **hands and willingness, not
size** — height already lives on the roster and already drives field placement,
so scoring it there counts the same inch twice.

**Predictions written before the data**, so they get checked rather than
rationalised after: hands and routes should correlate 0.85+ (both are "can he
play receiver", asked twice, 2.20 of the 6.00 total weight); coverage, speed and
throwing should be the independent axes; throwing will read 65 for ~13 of 17
while eating 11.7% of the weight, which will bunch the bottom of the football
board tighter than basketball's.

**Still unanswered: how does the QB get pressured?** If there is a rush, pass
rush is a real skill and none of the ten questions measures it.

Also open: nothing captures **conditioning**. Basketball weights athleticism 1.25
explicitly for "still going at 9-9"; football's `speed` is hinted as pure burst.

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

Not done. `vercel` CLI 59.6.2 is installed and the repo is linked to project
`run-it-back`. Before deploying:

- Set `EDIT_PASSCODE` in Vercel project env — **without it, anyone with the link
  can change ratings**
- Confirm the Neon integration's `DATABASE_URL` is on production
- Decide whether the link is shared as-is or gated further

**Demoing off localhost works but is fragile**: laptop must be awake with
`npm run dev` running, phones must be on the same Wi-Fi, the router can reassign
the LAN IP, and it serves an unoptimised dev build. The sleep timer is 1 minute —
run `caffeinate -d` if going that route.

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
- **Saved runs snapshot their teams** so old share links stay truthful as ratings
  change.
- **Viewing a rating is free; changing one is gated.**
- **Red and black belong to basketball**, green to football, white-blue-red to
  Nash itself. A sport's palette is derived from its accent, never hardcoded.
- **The landing plane leans one way (`\`) and no white is ever drawn into it.**
  Both were tried the other way and rejected on review, not in the abstract.
