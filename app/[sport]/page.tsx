import { notFound } from "next/navigation";
import Link from "next/link";
import { getRoster } from "@/app/actions";
import SportApp from "@/components/SportApp";
import { SPORTS, isSportId } from "@/lib/sports";
import type { RosterEntry } from "@/app/actions";

export function generateStaticParams() {
  return [{ sport: "basketball" }, { sport: "football" }];
}

export default async function SportPage({ params }: PageProps<"/[sport]">) {
  const { sport } = await params;
  if (!isSportId(sport)) notFound();

  const config = SPORTS[sport];

  let roster: RosterEntry[] = [];
  let setupError: string | null = null;
  try {
    roster = await getRoster(sport);
  } catch (error) {
    setupError = error instanceof Error ? error.message : "Could not reach the database.";
  }

  if (setupError) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Back
        </Link>
        <div className="mt-6 rounded-2xl border border-amber-900/60 bg-amber-950/30 p-5">
          <h1 className="text-lg font-semibold text-amber-200">Database not connected yet</h1>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/70">{setupError}</p>
        </div>
      </main>
    );
  }

  return <SportApp config={config} initialRoster={roster} />;
}
