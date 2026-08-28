import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompareBootstrap } from "@/app/actions";
import CompareApp from "@/components/CompareApp";
import { SPORTS, isSportId, sportChrome } from "@/lib/sports";

export default async function ComparePage({
  params,
}: PageProps<"/compare/[sport]">) {
  const { sport } = await params;
  if (!isSportId(sport) || SPORTS[sport].comingSoon) notFound();

  const config = SPORTS[sport];

  // The rater is only known on the client - it lives in localStorage so a
  // friend resumes where they left off - so the pool is fetched unfiltered here
  // and refetched per rater once that is read.
  let bootstrap;
  try {
    bootstrap = await getCompareBootstrap(sport, null);
  } catch {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Back
        </Link>
        <p className="mt-6 rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
          Couldn&apos;t reach the roster. Try again in a moment.
        </p>
      </main>
    );
  }

  if (bootstrap.pool.length < 3) notFound();

  return (
    <div
      className="flex flex-1 flex-col"
      style={sportChrome(config) as React.CSSProperties}
    >
      <CompareApp config={config} bootstrap={bootstrap} />
    </div>
  );
}
