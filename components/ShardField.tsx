/**
 * The landing page's backdrop: one plane in the shield palette, broken.
 *
 * Three rules hold this together, each of them a correction of an earlier try:
 *
 * 1. **Every long edge leans the same way — a `\`, down and to the right.**
 *    The two masses used to lean against each other to "collide", which read as
 *    a chevron pointing at the middle rather than as one broken plane.
 * 2. **Fragments share edges by tiling, not by having a line drawn between
 *    them.** An earlier version cut the whole canvas with opaque white slivers
 *    to force shared edges. It worked structurally, but the white broke the
 *    palette — the shield is red, white and blue, so white read as a fourth
 *    element rather than as ground. Bands are now flush: one band's edge *is*
 *    its neighbour's.
 * 3. **Neither colour crosses far into the other's territory.** Opposing-colour
 *    shards sit in the inner band against the white corridor and bleed only a
 *    little past it. The clash belongs at the border; a red wedge alone at the
 *    far left of the blue field is just a stray.
 */
const NAVY_DEEP = "#0b1b3f";
const NAVY = "#17408b";
const NAVY_MID = "#2f5fb8";
const NAVY_LIGHT = "#4a7fe0";
const BLUE_PALE = "#a8c4f0";
const RED_DEEP = "#8a0b22";
const RED = "#c8102e";
const RED_MID = "#e02b45";
const RED_LIGHT = "#ef5f74";
const RED_PALE = "#f6b6c0";

/**
 * The ramp into the ground. Pure white against BLUE_PALE/RED_PALE was a cliff:
 * the corridor read as a wall rather than as the same plane continuing, and at
 * maximum contrast every fragment near the border looked misplaced. These steps
 * carry each mass down to the ground so the border is a fade, not an edge — and
 * they eat most of the empty corridor on the way. GROUND is a hair off white for
 * the same reason; pure #fff was the brightest thing on the page by some margin.
 */
const BLUE_MIST = "#cfe0f7";
const BLUE_HAZE = "#e9f1fd";
const RED_MIST = "#fbd5dd";
const RED_HAZE = "#fdeef1";
const GROUND = "#f3f6fb";

type Shard = [points: string, fill: string, opacity?: number];

/* ---------------------------------------------------------------------------
 * Wide window: 160x100, one unit ~= 8px at 1280. Content sits in x 54-106.
 *
 * Bands are named by where they cross the top edge; the lean carries them
 * right as they descend, so the whole field sweeps one way and the white
 * corridor between the masses keeps a constant width.
 * ------------------------------------------------------------------------ */
const WIDE_LEAN = 22;

/** x of a `\` line at height y. Every long edge in the wide field is parallel. */
const wx = (xTop: number, y: number) => xTop + (WIDE_LEAN * y) / 100;

/** A band running the full height, between two parallel edges. */
const wideBand = (aTop: number, bTop: number) =>
  `${aTop},0 ${bTop},0 ${wx(bTop, 100)},100 ${wx(aTop, 100)},100`;

/**
 * A fragment of one band. `skew` offsets where the far edge is cut, so the
 * breaks across a band aren't level with each other.
 */
const wideShard = (
  aTop: number,
  bTop: number,
  y0: number,
  y1: number,
  skew: number,
) =>
  `${wx(aTop, y0)},${y0} ${wx(bTop, y0 + skew)},${y0 + skew} ` +
  `${wx(bTop, y1 + skew)},${y1 + skew} ${wx(aTop, y1)},${y1}`;

const WIDE: Shard[] = [
  // --- Blue mass, left. Darkest at the outside, stepping lighter toward the
  // corridor so the plane reads as lit from the middle.
  [wideBand(-24, 4), NAVY_DEEP],
  [wideBand(4, 12), NAVY],
  [wideBand(12, 19), NAVY_MID],
  [wideBand(19, 25), NAVY_LIGHT, 0.9],
  [wideBand(25, 30), BLUE_PALE, 0.6],
  [wideBand(30, 35), BLUE_MIST],
  [wideBand(35, 40), BLUE_HAZE],
  // --- Red at the blue border only. Each fragment replaces a *segment of a
  // band*, so its long edges are that band's own edges — the plane breaks
  // rather than getting a pane laid over it. Only the two innermost bands are
  // ever taken, which is what keeps the clash at the border.
  [wideShard(25, 30, -6, 26, 5), RED],
  [wideShard(19, 25, 12, 38, -4), RED_MID],
  [wideShard(25, 30, 58, 80, 6), RED_LIGHT],
  [wideShard(19, 25, 62, 88, -3), RED],
  [wideShard(25, 30, 84, 106, -5), RED_PALE],

  // --- Red mass, right. Same lean, mirrored ramp: lightest at the corridor.
  [wideBand(100, 105), RED_HAZE],
  [wideBand(105, 110), RED_MIST],
  [wideBand(110, 116), RED_PALE, 0.6],
  [wideBand(116, 123), RED_LIGHT, 0.9],
  [wideBand(123, 131), RED_MID],
  [wideBand(131, 142), RED],
  [wideBand(142, 190), RED_DEEP],
  // --- Blue at the red border only, same rule.
  [wideShard(110, 116, -6, 28, -5), NAVY],
  [wideShard(116, 123, 20, 48, 6), NAVY_MID],
  [wideShard(110, 116, 56, 82, -4), NAVY_LIGHT],
  [wideShard(116, 123, 76, 106, 5), BLUE_PALE],
];

/* ---------------------------------------------------------------------------
 * Phone: 100x200. Content sits in y 70-155.
 *
 * Vertical bands eat the whole width of a phone and leave nothing to put words
 * on, so here the masses crowd the top and bottom instead. They lean the same
 * `\` — for a band running across, that means the right end sits lower.
 * ------------------------------------------------------------------------ */
const TALL_DROP = 26;

/** y of a `\` line at horizontal position x. */
const ty = (yLeft: number, x: number) => yLeft + (TALL_DROP * x) / 100;

const tallBand = (aLeft: number, bLeft: number) =>
  `0,${aLeft} 100,${ty(aLeft, 100)} 100,${ty(bLeft, 100)} 0,${bLeft}`;

const tallShard = (
  aLeft: number,
  bLeft: number,
  x0: number,
  x1: number,
  skew: number,
) =>
  `${x0},${ty(aLeft, x0)} ${x1},${ty(aLeft, x1)} ` +
  `${x1 + skew},${ty(bLeft, x1 + skew)} ${x0 + skew},${ty(bLeft, x0 + skew)}`;

const TALL: Shard[] = [
  // --- Blue mass, top.
  [tallBand(-34, 6), NAVY_DEEP],
  [tallBand(6, 18), NAVY],
  [tallBand(18, 28), NAVY_MID],
  [tallBand(28, 35), NAVY_LIGHT, 0.9],
  [tallBand(35, 40), BLUE_PALE, 0.6],
  [tallBand(40, 45), BLUE_MIST],
  [tallBand(45, 50), BLUE_HAZE],
  // --- Red along the lower border of the blue, band-aligned as above.
  [tallShard(35, 40, -6, 30, 4), RED],
  [tallShard(28, 35, 18, 52, -3), RED_MID],
  [tallShard(35, 40, 62, 88, 5), RED_LIGHT],
  [tallShard(28, 35, 74, 112, -4), RED_PALE],

  // --- Red mass, bottom.
  [tallBand(146, 151), RED_HAZE],
  [tallBand(151, 156), RED_MIST],
  [tallBand(156, 164), RED_PALE, 0.6],
  [tallBand(164, 172), RED_LIGHT, 0.9],
  [tallBand(172, 181), RED_MID],
  [tallBand(181, 192), RED],
  [tallBand(192, 250), RED_DEEP],
  // --- Blue along the upper border of the red, band-aligned as above.
  [tallShard(156, 164, -6, 28, 5), NAVY],
  [tallShard(164, 172, 22, 54, -4), NAVY_MID],
  [tallShard(156, 164, 60, 86, 4), NAVY_LIGHT],
  [tallShard(164, 172, 80, 112, -5), BLUE_PALE],
];

function Field({ shards, viewBox }: { shards: Shard[]; viewBox: string }) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      {shards.map(([points, fill, opacity], i) => (
        <polygon key={i} points={points} fill={fill} opacity={opacity} />
      ))}
    </svg>
  );
}

export default function ShardField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ background: GROUND }}
    >
      <div className="hidden h-full w-full sm:block">
        <Field shards={WIDE} viewBox="0 0 160 100" />
      </div>
      <div className="h-full w-full sm:hidden">
        <Field shards={TALL} viewBox="0 0 100 200" />
      </div>
    </div>
  );
}
