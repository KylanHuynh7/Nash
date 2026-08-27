import { notFound } from "next/navigation";
import Link from "next/link";
import { getEditAccess, getRoster } from "@/app/actions";
import SportApp from "@/components/SportApp";
import { SPORTS, SPORT_IDS, isSportId } from "@/lib/sports";
import type { RosterEntry } from "@/app/actions";

export function generateStaticParams() {
  return SPORT_IDS.filter((id) => !SPORTS[id].comingSoon).map((sport) => ({
    sport,
  }));
}

export default async function SportPage({ params }: PageProps<"/[sport]">) {
  const { sport } = await params;
  if (!isSportId(sport) || SPORTS[sport].comingSoon) notFound();

  const config = SPORTS[sport];

  let roster: RosterEntry[] = [];
  let setupError: string | null = null;
  try {
    roster = await getRoster(sport);
  } catch (error) {
    setupError =
      error instanceof Error ? error.message : "Could not reach the database.";
  }

  if (setupError) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Back
        </Link>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h1 className="text-lg font-semibold text-amber-900">
            Database not connected yet
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            {setupError}
          </p>
        </div>
      </main>
    );
  }

  const access = await getEditAccess();

  return <SportApp config={config} initialRoster={roster} access={access} />;
}
