# Backups

Pre-change dumps of `comparisons` rows, taken immediately before the two
reattributions on 2026-08-28. They exist because **every environment shares one
`DATABASE_URL`** — there is no separate production database, so a delete here is
a delete in production and nothing else holds a copy of these rows.

| File | What it is | Rows |
|---|---|---|
| `2026-08-28-session-g8uxkw45-justin-as-taha.json` | One sitting Justin completed while identified as Taha | 80 |
| `2026-08-28-rater-alfonso-was-victor.json` | Two sittings Victor completed while identified as Alfonso | 100 |

Both were repaired the same way: rows reattributed to the real rater, then the
comparisons that became self-judgements (10 and 13) deleted. 70 and 87 valid
judgements were kept. See `context.md` §0 for why this happened twice.

## What is in them

Whole rows, exactly as they were: `id`, `sport`, `axis`, `rater_id`,
`session_id`, `left_id`, `right_id`, `winner_id`, `pair_key`, `created_at`.

**No names.** Every person is a UUID, so these files say nothing on their own —
they are only meaningful against the live `players` table. That is deliberate
and also the limit of what they can restore: they undo a reattribution, they do
not reconstruct the roster.

## Restoring one

Primary keys are preserved, so a restore is an upsert keyed on `id`. Reverting
the Justin/Taha session, for example:

```bash
npx dotenv -e .env.local -- node -e "
const rows = require('./backups/2026-08-28-session-g8uxkw45-justin-as-taha.json');
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
(async () => {
  for (const r of rows) {
    await sql\`insert into comparisons
      (id, sport, axis, rater_id, session_id, left_id, right_id, winner_id, pair_key, created_at)
      values (\${r.id}, \${r.sport}, \${r.axis}, \${r.rater_id}, \${r.session_id},
              \${r.left_id}, \${r.right_id}, \${r.winner_id}, \${r.pair_key}, \${r.created_at})
      on conflict (id) do update set rater_id = excluded.rater_id\`;
  }
  console.log('restored', rows.length);
})();
"
```

Read it before running it. It puts the wrong rater back on those rows, which is
the state the repair removed — only do this if the repair itself turns out to
have been wrong.

## Why these are committed when `ratings.csv` is not

`.gitignore` excludes the CSV exports, because those are regenerated from the
database whenever they are wanted. These cannot be: the rows they describe no
longer exist in that form anywhere. They are the only copy.
