/**
 * The backdrop behind a sport's page: brushed silver, with the plane shattered
 * at the centre.
 *
 * This is a different construction from the landing page's ShardField, because
 * it wants a different thing. ShardField breaks a plane into parallel bands —
 * orderly, one lean, a fault line. Here the break is an *impact*: shards radiate
 * from a centre, and they are meant to look chaotic.
 *
 * Chaos and connectedness pull against each other, and the obvious route to
 * chaos — scattering independent polygons — loses the connectedness at once:
 * that gives confetti, with silver showing through the gaps between pieces. So
 * the field is built as a **web**, not as a pile:
 *
 *   - A ring of rays leaves the centre at uneven angles.
 *   - Several rings cross them at uneven radii, jittered per ray.
 *   - Every shard is the quad between two neighbouring rays and two
 *     neighbouring rings.
 *
 * Because neighbouring shards are cut from the *same corner points*, every edge
 * is shared exactly — the mass is one shattered pane with no seams — while the
 * jitter on each point means no two shards are alike and no edge stays straight
 * for long. Jagged, and still connected.
 *
 * The outer ring fades unevenly, so the mass breaks up into the silver rather
 * than sitting on it as a disc.
 */

type Palette = {
  hot: string;
  red: string;
  redDeep: string;
  ink: string;
  inkSoft: string;
  silver: string;
};

function paletteFor(accent: string): Palette {
  const mix = (pct: number, base: string) =>
    `color-mix(in srgb, ${accent} ${pct}%, ${base})`;
  return {
    hot: mix(86, "#ff6a6a"),
    red: accent,
    redDeep: mix(66, "#0b0b0e"),
    ink: "#0d0d11",
    inkSoft: "#20202a",
    silver: "#c5c9d2",
  };
}

/**
 * Deterministic value noise, on integer arithmetic only.
 *
 * The field has to come out *bit*-identical on the server and on the client, or
 * React reports a hydration mismatch. Math.random() is the obvious way to fail
 * that, but the subtler one is `Math.sin` — the usual one-line hash noise —
 * which ECMAScript does not require to be identical across implementations.
 * Node's V8 and the browser's are different builds, and their last bits diverge,
 * which is enough to move a shard and mismatch the tree. Math.imul is exact
 * everywhere, so the hash is built from that instead.
 */
function noise(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Coordinates reach the DOM through this. Math.cos/Math.sin have the same
 * cross-implementation licence as above, so the geometry is rounded to a
 * precision far coarser than any divergence before it is ever stringified.
 */
const fx = (n: number) => n.toFixed(3);

const RAYS = 18;
/**
 * Ring radii as a fraction of the mass. The gaps widen outward, so shards grow
 * as they travel — the way fragments thrown from an impact do.
 */
const RINGS = [0.07, 0.2, 0.36, 0.55, 0.78, 1];

type Geometry = { cx: number; cy: number; reachX: number; reachY: number };

/**
 * A wide window and a phone need their own fields, not one field cropped.
 *
 * `slice` scales to cover, and on a 390-wide phone that means the 160-unit-wide
 * field is drawn some 1350 units across and clipped to its middle sliver —
 * which is precisely the point where every ray converges. The mass stopped
 * reading as fragments and started reading as a pinwheel. The phone gets a
 * viewBox in its own proportion instead, so the whole break is visible and the
 * silver still surrounds it.
 */
const WIDE: Geometry = { cx: 80, cy: 50, reachX: 58, reachY: 42 };
const TALL: Geometry = { cx: 50, cy: 100, reachX: 46, reachY: 64 };

type Pt = [number, number];

/**
 * Corner points of the web, jittered per ray *and* per ring, so that no ring is
 * a circle and no ray is straight.
 */
function pointsFor(g: Geometry): Pt[][] {
  return RINGS.map((ring, j) =>
    Array.from({ length: RAYS }, (_, i) => {
      // Uneven angular spacing, or the rays read as a pinwheel.
      const angle =
        ((i + 0.42 * (noise(i, 7) - 0.5)) / RAYS) * Math.PI * 2 + 0.35;
      // Radial jitter grows with the ring, so the outer edge is the raggedest.
      const wobble = 1 + (noise(i, j * 3 + 11) - 0.5) * (0.16 + j * 0.11);
      const r = ring * wobble;
      return [
        g.cx + Math.cos(angle) * r * g.reachX,
        g.cy + Math.sin(angle) * r * g.reachY,
      ] as Pt;
    }),
  );
}

type Shard = { points: string; fill: keyof Palette; opacity: number };

function buildShards(g: Geometry): Shard[] {
  const POINTS = pointsFor(g);
  const out: Shard[] = [];

  // The innermost ring closes on the centre as triangles, so the mass has a
  // core rather than a hole.
  for (let i = 0; i < RAYS; i++) {
    const a = POINTS[0][i];
    const b = POINTS[0][(i + 1) % RAYS];
    const n = noise(i, 91);
    out.push({
      points: `${fx(g.cx)},${fx(g.cy)} ${fx(a[0])},${fx(a[1])} ${fx(b[0])},${fx(b[1])}`,
      fill: n > 0.62 ? "hot" : n > 0.3 ? "red" : "ink",
      opacity: 1,
    });
  }

  for (let j = 0; j < RINGS.length - 1; j++) {
    for (let i = 0; i < RAYS; i++) {
      const k = (i + 1) % RAYS;
      const a = POINTS[j][i];
      const b = POINTS[j][k];
      const c = POINTS[j + 1][k];
      const d = POINTS[j + 1][i];
      const n = noise(i * 3 + 1, j * 7 + 2);

      // Red concentrates at the core and gives way to black on the way out, so
      // the impact reads as hot in the middle and cooling as it travels.
      const redBias = 0.62 - j * 0.13;
      let fill: keyof Palette;
      if (n < redBias * 0.28) fill = "hot";
      else if (n < redBias * 0.72) fill = "red";
      else if (n < redBias) fill = "redDeep";
      else if (n < redBias + (1 - redBias) * 0.55) fill = "ink";
      else if (n < redBias + (1 - redBias) * 0.86) fill = "inkSoft";
      else fill = "silver";

      // Only the last ring fades, and unevenly — a straight alpha ramp would
      // read as a soft vignette rather than as fragments thrown clear.
      const outer = j === RINGS.length - 2;
      const opacity = outer ? Number((0.16 + noise(i, 13) * 0.5).toFixed(3)) : 1;

      out.push({
        points: `${fx(a[0])},${fx(a[1])} ${fx(b[0])},${fx(b[1])} ` +
          `${fx(c[0])},${fx(c[1])} ${fx(d[0])},${fx(d[1])}`,
        fill,
        opacity,
      });
    }
  }
  return out;
}

const WIDE_SHARDS = buildShards(WIDE);
const TALL_SHARDS = buildShards(TALL);

/**
 * The cover's brushed sheen: long, near-horizontal light streaks drawn over the
 * silver but under the shards, so the mass stays the subject.
 */
const SHEEN: [x1: number, y1: number, x2: number, y2: number, w: number][] = [
  [-10, 18, 170, 4, 1.1],
  [-10, 30, 170, 12, 0.6],
  [-10, 64, 170, 46, 0.9],
  [-10, 82, 170, 60, 0.5],
  [-10, 95, 170, 74, 1.3],
];

/**
 * The silver itself. Kept here rather than in CSS because the page's ground and
 * the SVG's ground have to be the same colour — anywhere they differ shows up
 * as a seam when the backdrop repaints.
 */
export const SILVER_GROUND =
  "radial-gradient(120% 90% at 50% -10%, #ffffff 0%, rgba(255,255,255,0) 62%)," +
  "linear-gradient(158deg, #f6f7f9 0%, #dfe2e8 34%, #f2f3f6 56%, #cfd3db 78%, #e6e8ed 100%)";

function Field({
  shards,
  viewBox,
  sheenSpan,
  sheenRise,
  palette,
  veil,
}: {
  shards: Shard[];
  viewBox: string;
  /** The viewBox's width and height, so the sheen is stated once in the wide
   *  field's terms and stretched to whichever field is drawing it. */
  sheenSpan: number;
  sheenRise: number;
  palette: Palette;
  veil: number;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      <g stroke="#ffffff" strokeLinecap="round">
        {SHEEN.map(([x1, y1, x2, y2, w], i) => (
          <line
            key={i}
            x1={(x1 / 160) * sheenSpan}
            y1={(y1 / 100) * sheenRise}
            x2={(x2 / 160) * sheenSpan}
            y2={(y2 / 100) * sheenRise}
            strokeWidth={w}
            opacity={0.55}
          />
        ))}
      </g>
      {/*
       * The mass sits directly behind the content column, so at full strength
       * its black facets and the page's dark ink cancel each other out and
       * labels like the spread disappear. Held back toward the silver, it still
       * reads as red and black — it just stops competing with type.
       *
       * How far back it has to be held depends on how much is in front of it.
       * A page of cards covers most of the mass; a page with two buttons on it
       * leaves the facets bare behind the type, and the same 0.55 that reads as
       * a surface there reads as clutter here. Hence the prop.
       */}
      <g opacity={veil}>
        {shards.map((s, i) => (
          <polygon
            key={i}
            points={s.points}
            fill={palette[s.fill]}
            opacity={s.opacity}
          />
        ))}
      </g>
    </svg>
  );
}

export default function SportShards({
  accent,
  veil = 0.55,
}: {
  accent: string;
  /**
   * How strongly the shattered mass shows through, 0 to 1.
   *
   * The default is tuned for a page full of cards. Turn it down on a sparse
   * page, where the facets sit bare behind the type instead of behind content.
   */
  veil?: number;
}) {
  const palette = paletteFor(accent);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ background: SILVER_GROUND }}
    >
      <div className="hidden h-full w-full sm:block">
        <Field
          shards={WIDE_SHARDS}
          viewBox="0 0 160 100"
          sheenSpan={160}
          sheenRise={100}
          palette={palette}
          veil={veil}
        />
      </div>
      <div className="h-full w-full sm:hidden">
        <Field
          shards={TALL_SHARDS}
          viewBox="0 0 100 200"
          sheenSpan={100}
          sheenRise={200}
          palette={palette}
          veil={veil}
        />
      </div>
    </div>
  );
}
