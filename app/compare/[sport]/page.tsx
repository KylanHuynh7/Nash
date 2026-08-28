import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompareBootstrap } from "@/app/actions";
import CompareApp from "@/components/CompareApp";
import CompareLinkGate from "@/components/CompareLinkGate";
import { resolveRater } from "@/lib/rater";
import { SPORTS, isSportId, sportChrome } from "@/lib/sports";

/**
 * The comparison collector.
 *
 * Identity comes from the `?rater=` token in the link and from nowhere else.
 * The page used to render a dropdown of names and let people pick their own,
 * which failed twice out of five sittings — see `lib/rater-token.ts` for what
 * that cost. There is deliberately no picker to fall back to: keeping one would
 * leave the hole open for anyone still holding the old link, and the old link
 * is the one that already went out.
 */
export default async function ComparePage(
  props: PageProps<"/compare/[sport]">,
) {
  const { sport } = await props.params;
  if (!isSportId(sport) || SPORTS[sport].comingSoon) notFound();

  const config = SPORTS[sport];
  const chrome = sportChrome(config) as React.CSSProperties;
  const { rater: token, axis: axisParam } = await props.searchParams;

  // Which question this link asks. Unknown axes 404 rather than quietly
  // collecting under a key nothing will ever fit, and the default is always the
  // sport's first axis — the overall, which is the number the balancer uses.
  const axis = axisParam
    ? config.axes.find((a) => a.key === axisParam)
    : config.axes[0];
  if (!axis) notFound();

  // No token at all is the ordinary case for someone reopening the page from
  // their history, so the gate checks for a remembered link before refusing.
  if (token === undefined) {
    return (
      <div className="flex flex-1 flex-col" style={chrome}>
        <CompareLinkGate config={config} state="missing" />
      </div>
    );
  }

  const rater = await resolveRater(token);
  if (!rater) {
    return (
      <div className="flex flex-1 flex-col" style={chrome}>
        <CompareLinkGate config={config} state="invalid" />
      </div>
    );
  }

  // The rater is known before the first byte is rendered, so their answered
  // pairs come down with the page. This used to be a second round trip: the
  // name lived in localStorage, so the server had to render unfiltered and the
  // client refetched once it could read who was asking.
  let bootstrap;
  try {
    bootstrap = await getCompareBootstrap(sport, rater.id, axis.key);
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
    <div className="flex flex-1 flex-col" style={chrome}>
      <CompareApp
        config={config}
        axis={axis}
        bootstrap={bootstrap}
        rater={rater}
        token={String(token)}
      />
    </div>
  );
}
