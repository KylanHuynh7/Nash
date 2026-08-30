import type { ReactNode } from "react";
import type { Badge } from "@/lib/badges";

/**
 * The little picture on a badge, after 2K's and Madden's.
 *
 * Two things are encoded, and keeping them separate is the whole design:
 *
 *   SHAPE says which family    shield / circle / hexagon
 *   COLOUR says which tier     bronze / silver / gold / violet
 *
 * They have to be separate because only the attribute family is tiered.
 * Signature and combination badges are held or not held, so painting one gold
 * would claim a rank the derivation never computed — the same lie the text
 * label was written to avoid. An untiered badge gets a neutral frame, and its
 * shape is what tells you what kind of thing it is.
 *
 * Glyphs are keyed by ATTRIBUTE, not by badge. Speedster and Track Star both
 * draw the speed glyph and differ by frame, which is honest: they are two
 * questions about one number, and the family is the actual distinction. It
 * also means a new badge on an existing attribute costs no drawing.
 */

/** 24x24, centred on (12,12), drawn in `currentColor`. */
const GLYPHS: Record<string, ReactNode> = {
  /* ---------------- shared ---------------- */
  // Speed — a bolt. Straight-line burst.
  speed: <path d="M13 2 5 13h5l-1 9 8-11h-5l1-9Z" />,
  // Stamina — a battery still holding charge.
  stamina: (
    <>
      <rect x="3" y="8" width="15" height="9" rx="2" />
      <path d="M21 11v3" />
      <path d="M6 11v3M9.5 11v3M13 11v3" />
    </>
  ),
  // Strength — a dumbbell.
  strength: (
    <>
      <path d="M3 9v6M6 7v10M18 7v10M21 9v6" />
      <path d="M6 12h12" />
    </>
  ),

  /* ---------------- football ---------------- */
  // Quickness — a hard cut, one step and back the other way.
  quickness: <path d="M4 20 10 12 7 10.5 14 4l-2 7 3-1.5L9 20Z" />,
  // Hands — catching, two hands closing on the ball.
  hands: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c1.5-4 4-6 7-6s5.5 2 7 6" />
    </>
  ),
  // Contested catch — going up over someone.
  contested_catch: (
    <>
      <circle cx="12" cy="5.5" r="2.6" />
      <path d="M6 21c0-5 2.5-8 6-8s6 3 6 8" />
      <path d="M4 12l3-2M20 12l-3-2" />
    </>
  ),
  // After the catch — breaking through the first man.
  yac: (
    <>
      <path d="M3 12h11" />
      <path d="M11 8l4 4-4 4" />
      <path d="M18 6v12" />
    </>
  ),
  // Short routes — a slant off the line.
  short_routes: (
    <>
      <path d="M5 20v-7" />
      <path d="M5 13l8-8" />
      <path d="M13 5h-4M13 5v4" />
    </>
  ),
  // Deep routes — straight up the field, gone.
  deep_routes: (
    <>
      <path d="M12 21V5" />
      <path d="M7 10l5-5 5 5" />
      <path d="M4 21h16" />
    </>
  ),
  // Man coverage — locked onto one man.
  man_coverage: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  // Zone awareness — reading it before it happens.
  zone_awareness: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  // Pass rush — getting home on the count.
  pass_rush: (
    <>
      <path d="M20 4 9 15" />
      <path d="M20 4v6M20 4h-6" />
      <path d="M4 20l6-6" />
      <path d="M4 20v-5M4 20h5" />
    </>
  ),
  // Throwing — the ball on its arc.
  throwing: (
    <>
      <path d="M3 18c6-11 12-13 18-12" />
      <ellipse cx="15" cy="9" rx="3.4" ry="2.4" transform="rotate(-35 15 9)" />
    </>
  ),

  /* ---------------- basketball ---------------- */
  // Driving layup — attacking the rim.
  driving_layup: (
    <>
      <path d="M4 20 14 6" />
      <circle cx="17" cy="5" r="2.4" />
      <path d="M8 20h12" />
    </>
  ),
  // Post control — backing a man down.
  post_control: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 4v16" />
      <circle cx="8" cy="12" r="2" />
    </>
  ),
  // Defensive board — pulling it down.
  def_reb: (
    <>
      <circle cx="12" cy="7" r="3.4" />
      <path d="M12 12v8" />
      <path d="M8 16l4 4 4-4" />
    </>
  ),
  // Offensive board — putting it back up.
  off_reb: (
    <>
      <circle cx="12" cy="17" r="3.4" />
      <path d="M12 12V4" />
      <path d="M8 8l4-4 4 4" />
    </>
  ),
  // Perimeter D — staying in front, out on the line.
  perimeter_d: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />
    </>
  ),
  // Interior D — holding the paint.
  interior_d: (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />
      <path d="M9 12h6" />
    </>
  ),
  // Steal — a hand in the passing lane.
  steal: (
    <>
      <path d="M3 8h9" />
      <path d="M9 5l3 3-3 3" />
      <path d="M15 4v9a4 4 0 0 1-8 0" />
    </>
  ),
  // Block — meeting it at the top.
  block: (
    <>
      <path d="M4 20V9" />
      <path d="M4 9c0-3 2-5 5-5" />
      <path d="M20 20V9" />
      <path d="M20 9c0-3-2-5-5-5" />
      <path d="M9 4h6" />
    </>
  ),
  // Mid-range — the pull-up.
  mid_range: (
    <>
      <path d="M4 18c4-9 12-9 16 0" />
      <circle cx="4" cy="18" r="1.8" />
      <path d="M16 18h6" />
    </>
  ),
  // Three-point — from deep.
  three_point: (
    <>
      <path d="M3 20c5-13 13-13 18 0" />
      <circle cx="12" cy="6.5" r="2" />
      <path d="M7 20h10" />
    </>
  ),
  // Passing — putting it on target.
  pass_accuracy: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  // Handles — the crossover.
  ball_handle: (
    <>
      <path d="M4 6c0 6 16 6 16 12" />
      <circle cx="4" cy="6" r="1.8" />
      <circle cx="20" cy="18" r="1.8" />
    </>
  ),

  /* ---------------- specials ---------------- */
  // No holes anywhere.
  complete: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 12.5l2.8 2.8L16 9.5" />
    </>
  ),
};

/** A badge on an attribute nothing has drawn yet still gets a mark. */
const FALLBACK = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v8M8 12h8" />
  </>
);

/**
 * The frame, one per family.
 *
 * Drawn on a 40x40 box and filled, so the glyph reads against it rather than
 * floating. Shield for the accomplishment core, circle for a signature, hexagon
 * for a style.
 */
const FRAMES: Record<
  Badge["family"],
  { path: string; cx: number; cy: number; scale: number }
> = {
  // A shield tapers to a point, so its glyph sits above centre and runs
  // smaller — centred on the box, the lower half of a glyph collides with the
  // taper and the mark looks like it is falling out of the frame.
  attribute: {
    path: "M20 2 4 7v14c0 8 7 13 16 17 9-4 16-9 16-17V7Z",
    cx: 20,
    cy: 18.5,
    scale: 0.76,
  },
  signature: {
    path: "M20 2a18 18 0 1 0 0 36 18 18 0 1 0 0-36Z",
    cx: 20,
    cy: 20,
    scale: 0.78,
  },
  combination: {
    path: "M20 2 36 11v18L20 38 4 29V11Z",
    cx: 20,
    cy: 20,
    scale: 0.76,
  },
};

/**
 * Frame colours, matching `badgeTone` on the text pill so the icon and the
 * label read as one object rather than two.
 *
 * Held as literal class strings: Tailwind only generates what it can see, and
 * an interpolated `border-${tier}-400` silently produces nothing — the failure
 * that once rendered the mobile wordmark at 16px.
 */
function frameTone(badge: Badge): { stroke: string; fill: string } {
  if (badge.family !== "attribute") {
    return { stroke: "text-muted", fill: "fill-white/[0.04]" };
  }
  switch (badge.tier) {
    case "hof":
      return { stroke: "text-violet-300", fill: "fill-violet-400/20" };
    case "gold":
      return { stroke: "text-yellow-300", fill: "fill-yellow-400/15" };
    case "silver":
      return { stroke: "text-zinc-200", fill: "fill-zinc-300/15" };
    default:
      return { stroke: "text-amber-300/90", fill: "fill-amber-600/20" };
  }
}

export default function BadgeIcon({
  badge,
  size = 34,
}: {
  badge: Badge;
  size?: number;
}) {
  const { stroke, fill } = frameTone(badge);
  const glyph = GLYPHS[badge.icon] ?? FALLBACK;
  const frame = FRAMES[badge.family];
  // The glyph is drawn on a 24-box; place its centre at the frame's optical
  // centre rather than the box's geometric one.
  const offset = (c: number) => c - 12 * frame.scale;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={`shrink-0 ${stroke}`}
      // Decorative: the badge name sits right beside it, so announcing the
      // shape again would just make a screen reader say everything twice.
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={frame.path}
        className={fill}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <g
        transform={`translate(${offset(frame.cx).toFixed(2)} ${offset(frame.cy).toFixed(2)}) scale(${frame.scale})`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {glyph}
      </g>
    </svg>
  );
}
