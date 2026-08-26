import Link from "next/link";
import { notFound } from "next/navigation";
import { getRun } from "@/app/actions";
import { Rating, teamColor } from "@/components/ui";
import { SPORTS, isSportId } from "@/lib/sports";

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

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16 pt-6 lg:max-w-3xl lg:px-8 lg:pt-10">
      <header className="mb-5">
        <Link
          href={`/${run.sport}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← {config.label}
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight">
          <span aria-hidden className="mr-1.5">
            {config.emoji}
          </span>
          {run.label ?? "Teams"}
        </h1>
        <p className="text-sm text-muted">
          {new Date(run.createdAt).toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}{" "}
          · spread {(run.spread / 10).toFixed(1)}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {run.teams.map((team, i) => {
          const total = team.players.reduce((s, p) => s + p.overall, 0);
          const average = team.players.length
            ? Math.round((total / team.players.length) * 10) / 10
            : 0;
          return (
            <div
              key={i}
              className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 rounded-full ${teamColor(i).dot}`}
                  />
                  {teamColor(i).label}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-mono tabular-nums">avg {average}</span>
                  <Rating value={Math.round(average)} size="sm" />
                </div>
              </div>
              <ul className="space-y-1.5">
                {team.players.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 text-sm">
                    <span className="w-8 shrink-0 font-mono text-[10px] uppercase text-muted">
                      {positions.get(p.position) ?? p.position}
                    </span>
                    <span className="flex-1">{p.name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted">
                      {p.overall}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
