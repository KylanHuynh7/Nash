/**
 * The NFL comps for each football player — authored, not collected, and given
 * in two eras.
 *
 * **This is the second answer to the comp question, and it is a different
 * answer.** The collected version asks the group and prints a name once two
 * raters agree. That route was tried and it failed on the denominator: after a
 * full round every subject had exactly one answer, so no pair ever cleared the
 * bar and the feature collected singletons. Asking thirteen people to pick a
 * receiver each would fail the same way for the same reason.
 *
 * So these are picked, by one person, on purpose. That makes the attribution
 * rule load-bearing rather than decorative: a card showing one of these must
 * never present it as what the group thinks. It says "picked, not voted", and
 * the collected path keeps its own "N of M said so" wording. The app has twice
 * shipped one person's answer dressed as a consensus; the fix is to label it,
 * not to hide it.
 *
 * **Two eras, because one list could not keep its story straight.** The first
 * pass mixed active players with players retired for fifteen years under a
 * single heading, so "plays like" silently meant two different things — a
 * player you could watch this Sunday, and an archetype's canonical version.
 * Splitting them makes each column answerable on its own terms: `modern` is
 * someone currently playing, `allTime` is the best historical fit regardless of
 * era. A player can have one and not the other, and that is a real state.
 *
 * Chosen against the twelve attributes rather than by position, because that is
 * where the resemblance actually lives — the group plays 5-a-side, pass only,
 * everyone both ways, so a comp has to cover how someone covers as well as how
 * they catch. Defensive names are here for that reason and are not a category
 * error.
 *
 * Keyed by name, matching the rating scripts. A name with no entry renders no
 * comp at all, which is the right state for a player nobody has picked for.
 */
export type NflComp = { modern?: string; allTime?: string };

export const NFL_COMPS: Record<string, NflComp> = {
  // No hole anywhere: top hands, top coverage, near-top speed, and no single
  // freak trait. Both picks are "complete receiver" rather than "best ever" —
  // the 99 on this sheet means best of thirteen friends, not best in the world.
  Orion: { modern: "Justin Jefferson", allTime: "Torry Holt" },
  // 5'5", quickest and fastest here, best after the catch, and one of two real
  // arms. Hill threw touchdowns too; Smith was the small man nobody could tackle.
  Brian: { modern: "Tyreek Hill", allTime: "Steve Smith Sr." },
  // Hands 97 and Deep Routes 96 on 85 speed. Wins on release and tracking
  // rather than pace, which is the whole Harrison argument.
  Kylan: { modern: "Nico Collins", allTime: "Marvin Harrison" },
  // Reshaped 2026-08-29 into the archetype: Contested 95, Hands 93, Deep 89,
  // and he kept his quickness. Big-body target who still separates.
  Victor: { modern: "Tee Higgins", allTime: "Larry Fitzgerald" },
  // Speed 90 and Deep 86, Short Routes 78. Straight line only.
  Rayan: { modern: "Jameson Williams", allTime: "DeSean Jackson" },
  // Contested Catch 97, the best on the roster, on Speed 76 and Quickness 74.
  // The jump ball is the whole game.
  Joe: { modern: "Mark Andrews", allTime: "Jimmy Graham" },
  // Pass Rush 97, nine clear of anyone else, and nothing else above the middle.
  // Freeney is the size-honest one — Danny is 5'6".
  Danny: { modern: "Micah Parsons", allTime: "Dwight Freeney" },
  // Tallest here at 6'1". Contested 92, Hands 85, and a quickness that was
  // sitting at the roster floor until 2026-08-29.
  Jason: { modern: "Hunter Henry", allTime: "Jason Witten" },
  // Throwing 96, everything else 76-83. The arm is what he is — and his badge
  // is already called Gunslinger.
  Lucas: { modern: "Matthew Stafford", allTime: "Brett Favre" },
  // Man Coverage 97 and Hands 73. Entirely a defender.
  Justin: { modern: "Patrick Surtain II", allTime: "Darrelle Revis" },
  // Stamina 97, never comes off, and Hands 68 / Contested 66. A motor, not a
  // target — which is what a gunner is.
  Sangwon: { modern: "JT Gray", allTime: "Matthew Slater" },
  // At the floor on eleven of twelve; Throwing 74 is the only thing above it.
  Alfonso: { modern: "Jacoby Brissett", allTime: "Chad Henne" },
  // The group's call, and deliberately not derived from the numbers — there is
  // no offensive line in a 5-a-side pass game for an O-lineman comp to come
  // from. No all-time pick: nobody has made one, and inventing one to fill the
  // slot would be the only entry here with no author behind it.
  Sean: { modern: "Cody Ford" },
};
