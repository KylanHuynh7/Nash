/**
 * The backdrop behind a sport's page: the arena floor, broken.
 *
 * The landing page's ShardField breaks a *light* plane into two masses that
 * meet at a corridor. This one has a different job and so a different shape:
 * the content column sits on top of it, so the field has to be loud where
 * there are no words and nearly silent where there are.
 *
 * Three rules, the same discipline as ShardField:
 *
 * 1. **Every long edge leans the same way — a `\`, down and to the right.**
 *    One lean for the whole field is what makes it read as a single plane that
 *    broke, rather than as scattered triangles.
 * 2. **Fragments replace a segment of a band, so their long edges are that
 *    band's own edges.** Nothing is laid *over* the plane; the plane itself
 *    comes apart. Skewing where each fragment is cut keeps the breaks from
 *    lining up into a stripe.
 * 3. **Value falls to the ground by the halfway mark.** The colour is spent in
 *    the top third, above and behind the header, and everything below it ramps
 *    into near-black so roster cards keep their contrast. A shard field that
 *    stays bright to the bottom is a wallpaper, not a backdrop.
 *
 * Everything is derived from the sport's one declared accent, so football gets
 * this for free in green the day its ratings land.
 */

type Palette = {
  hot: string;
  full: string;
  deep: string;
  dusk: string;
  ember: string;
  charHi: string;
  char: string;
  ground: string;
};

/**
 * The ramp from accent to ground. The steps are uneven on purpose: the top of
 * the ramp is where the colour lives, so it gets the wide, saturated stops,
 * and the bottom crowds together into a set of near-blacks that differ just
 * enough to catch a facet edge without ever reading as a shape.
 */
function paletteFor(accent: string): Palette {
  const mix = (pct: number, base: string) =>
    `color-mix(in srgb, ${accent} ${pct}%, ${base})`;
  return {
    hot: mix(88, "#ff5a5a"),
    full: mix(82, "#07070a"),
    deep: mix(48, "#07070a"),
    dusk: mix(26, "#07070a"),
    ember: mix(15, "#07070a"),
    charHi: mix(11, "#1a1a22"),
    char: mix(9, "#101015"),
    // Matches --background from sportChrome, so the SVG and the div behind it
    // are the same colour and the field has no visible bottom edge.
    ground: mix(7, "#07070a"),
  };
}

type Shard = [points: string, fill: keyof Palette, opacity?: number];

/* ---------------------------------------------------------------------------
 * Wide window: 160x100. Bands run across rather than down — vertical bands
 * would stand behind the whole content column for its full height, and no
 * amount of dimming makes that quiet.
 * ------------------------------------------------------------------------ */
const WIDE_DROP = 18;

/** y of a `\` line at horizontal position x. Every long edge is parallel. */
const wy = (yLeft: number, x: number) => yLeft + (WIDE_DROP * x) / 160;

const wideBand = (aLeft: number, bLeft: number) =>
  `0,${aLeft} 160,${wy(aLeft, 160)} 160,${wy(bLeft, 160)} 0,${bLeft}`;

/**
 * A fragment of one band, cut between x0 and x1. `skew` offsets where the far
 * edge is cut, so a fragment is a leaning quadrilateral rather than a block.
 */
const wideShard = (
  aLeft: number,
  bLeft: number,
  x0: number,
  x1: number,
  skew: number,
) =>
  `${x0},${wy(aLeft, x0)} ${x1},${wy(aLeft, x1)} ` +
  `${x1 + skew},${wy(bLeft, x1 + skew)} ${x0 + skew},${wy(bLeft, x0 + skew)}`;

const WIDE: Shard[] = [
  // --- The ramp. It is spent by y=54 and almost all of the saturated colour
  // sits above y=18 — behind the header, above the first roster chip.
  [wideBand(-34, -12), "hot"],
  [wideBand(-12, 0), "full"],
  [wideBand(0, 9), "deep"],
  [wideBand(9, 18), "dusk"],
  [wideBand(18, 28), "ember"],
  [wideBand(28, 40), "charHi"],
  [wideBand(40, 54), "char"],

  // --- Dark breaking upward into the colour. These are what stop the ramp
  // from reading as a gradient: a band loses a segment to the value two steps
  // below it, so the plane looks fractured rather than blended.
  [wideShard(-12, 0, 6, 48, 4), "deep"],
  [wideShard(0, 9, 60, 102, -5), "dusk"],
  [wideShard(9, 18, 16, 56, 5), "ember"],
  [wideShard(-12, 0, 98, 140, -4), "dusk"],
  [wideShard(0, 9, 116, 164, 4), "ember"],
  [wideShard(9, 18, 72, 118, -5), "charHi"],
  [wideShard(18, 28, 30, 76, 5), "charHi"],

  // --- Colour breaking downward into the dark. Held to the right and to the
  // outer margins, which is where the content column isn't. A staircase of
  // fragments stepping down to the right carries the eye the way the cover's
  // arrow does, without introducing a second angle to the plane.
  [wideShard(9, 18, 112, 150, 5), "full"],
  [wideShard(18, 28, 128, 168, -4), "deep"],
  [wideShard(28, 40, 142, 178, 5), "dusk"],
  [wideShard(9, 18, -8, 20, -4), "full"],
  [wideShard(18, 28, -10, 14, 4), "deep"],
  [wideShard(28, 40, -12, 10, -3), "ember"],
  // Two low embers so the bottom half catches an edge instead of going dead.
  [wideShard(40, 54, 134, 174, 4), "dusk"],
  [wideShard(40, 54, -12, 8, -4), "charHi"],
];

/* ---------------------------------------------------------------------------
 * Phone: 100x200. Same construction, but the ramp is stretched — a phone shows
 * the top of the page for much longer, so the colour has further to fall.
 * ------------------------------------------------------------------------ */
const TALL_DROP = 20;

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
  // A phone stacks the header, the tab row and the roster into the top third,
  // so the ramp is *compressed* rather than stretched: the saturated steps are
  // spent by y=16 — under the header — and the muted subtitle never has to sit
  // on a bright band.
  [tallBand(-40, -16), "hot"],
  [tallBand(-16, -2), "full"],
  [tallBand(-2, 7), "deep"],
  [tallBand(7, 16), "dusk"],
  [tallBand(16, 28), "ember"],
  [tallBand(28, 44), "charHi"],
  [tallBand(44, 64), "char"],

  // Dark up into the colour.
  [tallShard(-16, -2, 4, 42, 4), "deep"],
  [tallShard(-2, 7, 48, 90, -5), "dusk"],
  [tallShard(7, 16, 10, 46, 5), "ember"],
  [tallShard(-2, 7, -8, 18, 4), "ember"],
  [tallShard(16, 28, 54, 98, -4), "charHi"],

  // Colour down into the dark, kept to the edges.
  [tallShard(7, 16, 70, 108, 4), "full"],
  [tallShard(16, 28, 78, 112, -5), "deep"],
  [tallShard(28, 44, 88, 118, 4), "dusk"],
  [tallShard(16, 28, -12, 12, -4), "full"],
  [tallShard(28, 44, -14, 8, 4), "deep"],
  [tallShard(44, 64, 86, 116, -4), "charHi"],
];

/**
 * The cover's tick texture: small crosses scattered over the plane where it is
 * already dark. They sit at a low opacity and never near the top, where the
 * colour is doing the work on its own.
 */
const TICKS: [x: number, y: number, r: number][] = [
  [12, 62, 1.6],
  [20, 71, 1.2],
  [8, 78, 1.4],
  [17, 86, 1.1],
  [143, 55, 1.6],
  [151, 64, 1.2],
  [136, 72, 1.4],
  [148, 81, 1.1],
  [128, 88, 1.3],
];

function Ticks({ scaleX }: { scaleX: number }) {
  return (
    <g stroke="currentColor" strokeWidth={0.3} opacity={0.2}>
      {TICKS.map(([x, y, r], i) => {
        const cx = x * scaleX;
        return (
          <g key={i}>
            <line x1={cx - r} y1={y - r} x2={cx + r} y2={y + r} />
            <line x1={cx - r} y1={y + r} x2={cx + r} y2={y - r} />
          </g>
        );
      })}
    </g>
  );
}

function Field({
  shards,
  viewBox,
  palette,
  tickScaleX,
}: {
  shards: Shard[];
  viewBox: string;
  palette: Palette;
  tickScaleX: number;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      style={{ color: palette.dusk }}
      aria-hidden
    >
      {shards.map(([points, fill, opacity], i) => (
        <polygon key={i} points={points} fill={palette[fill]} opacity={opacity} />
      ))}
      <Ticks scaleX={tickScaleX} />
    </svg>
  );
}

export default function SportShards({ accent }: { accent: string }) {
  const palette = paletteFor(accent);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ background: palette.ground }}
    >
      <div className="hidden h-full w-full sm:block">
        <Field
          shards={WIDE}
          viewBox="0 0 160 100"
          palette={palette}
          tickScaleX={1}
        />
      </div>
      <div className="h-full w-full sm:hidden">
        <Field
          shards={TALL}
          viewBox="0 0 100 200"
          palette={palette}
          tickScaleX={0.625}
        />
      </div>
    </div>
  );
}
