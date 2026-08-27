import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun } from "@/app/actions";
import { Rating, teamColor } from "@/components/ui";
import { buildMatchups } from "@/lib/lineup";
import { SPORTS, isSportId, sportChrome } from "@/lib/sports";

export default async function RunPage({ params }: PageProps<"/run/[id]">) {
  const { id } = await params;

  let run;
  try {
    run = await getRun(id);
  } catch {
    notFound();
  }
  if (!run || !isSportId(run.sport)) notFound();

  const config = SPORTS[run.sport];
  const positions = new Map(config.positions.map((p) => [p.key, p.label]));
  const teams = run.teams.map((t) => t.players);
  // A shared link showed two flat lists, which loses the thing the court view
  // exists for: two teams can average the same and still be lopsided at three
  // spots. The snapshot has positions, so the matchups can be rebuilt from it.
  const matchups = teams.length === 2 ? buildMatchups(config, teams) : [];

  return (
    <main
      className="mx-auto w-full max-w-md flex-1 px-5 pb-16 pt-6 lg:max-w-3xl lg:px-8 lg:pt-10"
      style={sportChrome(config) as React.CSSProperties}
    >
      {/* Without this the page wears Nash's navy while its cards wear the
          sport's colour — a link out of basketball has to look like basketball. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: sportChrome(config)["--page-background"] }}
      />

      <header className="mb-6">
        <Link
          href={`/${run.sport}`}
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← {config.label}
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-xl shadow-[0_0_22px_color-mix(in_srgb,var(--accent)_55%,transparent)]"
          >
            {config.emoji}
          </span>
          <div>
            <h1 className="metal text-2xl leading-none">
              {run.label ?? "Teams"}
            </h1>
            <p className="eyebrow mt-1.5">
              {new Date(run.createdAt).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}{" "}
              · spread {(run.spread / 10).toFixed(1)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {run.teams.map((team, i) => {
          const total = team.players.reduce((s, p) => s + p.overall, 0);
          const average = team.players.length
            ? Math.round((total / team.players.length) * 10) / 10
            : 0;
          const color = teamColor(i);
          return (
            <div
              key={i}
              className={`rounded-lg border bg-surface p-4 shadow-[var(--shadow-card)] ${color.ring}`}
            >
              <div className="mb-3 flex items-center justify-between border-b border-line pb-2.5">
                <h2 className="flex items-center gap-2 font-bold uppercase tracking-wide">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${color.dot}`}
                  />
                  {color.label}
                </h2>
                {/* A team average is not a player rating, so it doesn't get the
                    tier colours — an even 78 shouldn't read as a weak player. */}
                <span className="figure text-sm text-muted">avg {average}</span>
              </div>
              <ul className="space-y-2">
                {team.players.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 text-sm">
                    <span className="figure w-9 shrink-0 text-[10px] uppercase text-muted">
                      {positions.get(p.position) ?? p.position}
                    </span>
                    <span className="flex-1 truncate font-medium">{p.name}</span>
                    <Rating value={p.overall} size="sm" />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {matchups.length > 0 && (
        <section className="mt-6">
          <h2 className="eyebrow mb-2.5">Head to head</h2>
          <ul className="overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--shadow-card)]">
            {matchups.map((m) => {
              const [a, b] = m.players;
              const delta = a && b ? a.overall - b.overall : 0;
              const leader = delta === 0 ? null : delta > 0 ? 0 : 1;
              return (
                <li
                  key={m.position}
                  className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-b-0"
                >
                  <span className="figure w-9 shrink-0 text-[10px] uppercase text-muted">
                    {m.label}
                  </span>
                  <span className="flex-1 truncate text-right">
                    {a?.name ?? "—"}
                  </span>
                  {/* The lead sits on the row of whoever holds it and takes
                      that team's colour, so it can't be read backwards. */}
                  <span
                    className={`figure w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold ${
                      leader === null
                        ? "text-muted"
                        : teamColor(leader).chip + " border"
                    }`}
                  >
                    {leader === null
                      ? "even"
                      : `${teamColor(leader).label[0]} +${Math.abs(delta)}`}
                  </span>
                  <span className="flex-1 truncate">{b?.name ?? "—"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
