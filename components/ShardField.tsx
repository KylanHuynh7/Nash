/**
 * The landing page's backdrop: a collage of angular fragments in the shield
 * palette, after the way the 2K covers break a photo into torn planes.
 *
 * Drawn as SVG rather than clip-path divs because the point is *variety* —
 * two dozen fragments at different angles, sizes and depths. Parallel bands all
 * cut on the same diagonal read as stripes; what makes it read as shattered is
 * shards that disagree with each other.
 *
 * Neither colour keeps to its own half. Red slashes cut across the blue side
 * and blue fragments land inside the red, at angles that disagree with the
 * planes underneath them — that intrusion is what makes it read as shattered
 * rather than as two territories meeting at a border.
 *
 * Two compositions, swapped at the breakpoint: fragments crowd the left and
 * right on a wide window, and the top and bottom on a phone. Both leave the
 * middle clear, because that is where the words go.
 */
const NAVY_DEEP = "#0b1b3f";
const NAVY = "#17408b";
const NAVY_MID = "#2f5fb8";
const NAVY_LIGHT = "#4a7fe0";
const BLUE_PALE = "#a8c4f0";
const RED = "#c8102e";
const RED_MID = "#e02b45";
const RED_LIGHT = "#ef5f74";
const RED_PALE = "#f6b6c0";

type Shard = [points: string, fill: string, opacity?: number];

/** Wide window: 160x100, so one unit is 8px at 1280. Content sits in 44-116. */
const WIDE: Shard[] = [
  // Left: blue planes, then red cutting straight through them.
  ["0,0 31,0 11,100 0,100", NAVY_DEEP],
  ["16,0 40,0 20,100 4,100", NAVY, 0.96],
  ["33,0 43,0 24,100 16,100", NAVY_MID, 0.8],
  ["41,0 46,0 27,100 22,100", NAVY_LIGHT, 0.66],
  ["6,0 22,0 38,52 27,64", NAVY_LIGHT, 0.45],
  ["0,56 21,100 0,100", NAVY_MID, 0.85],
  ["24,72 39,62 42,82 30,91", BLUE_PALE, 0.5],
  ["0,0 14,0 4,21", NAVY_LIGHT, 0.35],
  ["12,86 27,78 29,100 17,100", NAVY_LIGHT, 0.38],
  // Red intrusions on the blue side.
  ["1,14 26,2 31,15 6,29", RED, 0.82],
  ["0,66 28,47 32,57 4,77", RED_MID, 0.62],
  ["17,40 31,31 35,45 21,52", RED_LIGHT, 0.55],
  ["34,88 47,81 49,96 37,100", RED_PALE, 0.5],
  ["8,94 20,88 22,100 10,100", RED_MID, 0.4],
  ["36,20 45,14 47,29 38,33", RED_PALE, 0.38],

  // Right: red planes, then blue cutting through them.
  ["134,0 160,0 160,100 147,100", RED],
  ["119,0 137,0 152,100 138,100", RED_MID, 0.95],
  ["112,0 123,0 139,100 131,100", RED_LIGHT, 0.5],
  ["150,0 160,0 160,40 155,34", RED_PALE, 0.45],
  ["104,42 117,34 121,55 110,61", RED_LIGHT, 0.4],
  ["160,86 160,100 141,100", RED_LIGHT, 0.55],
  ["108,0 117,0 125,23 117,26", RED_PALE, 0.3],
  // Blue intrusions on the red side.
  ["129,8 157,0 160,13 135,23", NAVY, 0.78],
  ["116,58 149,41 153,52 121,70", NAVY_MID, 0.6],
  ["139,78 153,71 156,87 143,92", NAVY_LIGHT, 0.5],
  ["123,28 136,22 139,37 126,42", BLUE_PALE, 0.42],
  ["146,94 158,88 160,100 148,100", NAVY_MID, 0.4],
  ["127,88 138,83 140,97 129,100", BLUE_PALE, 0.34],

  // Chips drifting inward, each the *other* side's colour, kept out of the
  // text band so nothing lands behind a word.
  ["50,3 61,0 59,13 49,16", RED_PALE, 0.4],
  ["95,90 107,84 109,98 98,100", BLUE_PALE, 0.36],
  ["104,5 114,1 116,13 106,16", NAVY_LIGHT, 0.32],
  ["45,88 56,83 58,96 47,100", RED_PALE, 0.32],
  ["64,92 73,88 74,100 65,100", NAVY_LIGHT, 0.22],
  ["88,2 97,0 98,10 89,12", RED_PALE, 0.24],
];

/** Phone: 100x200. Fragments crowd the top and bottom; content sits in 70-155. */
const TALL: Shard[] = [
  // Top: blue planes with red cutting across them.
  ["0,0 100,0 100,20 0,34", NAVY_DEEP],
  ["0,0 100,0 100,11 0,20", NAVY, 0.97],
  ["0,34 100,20 100,29 0,43", NAVY_MID, 0.8],
  ["0,43 100,29 100,35 0,49", NAVY_LIGHT, 0.6],
  ["0,0 34,0 8,44", NAVY_LIGHT, 0.42],
  ["62,0 100,0 100,26 74,20", NAVY_MID, 0.36],
  ["14,46 45,36 49,56 18,64", BLUE_PALE, 0.36],
  ["0,56 23,48 25,62 0,68", BLUE_PALE, 0.26],
  ["0,14 38,2 42,13 4,26", RED, 0.72],
  ["46,24 88,10 92,22 50,37", RED_MID, 0.55],
  ["8,52 36,42 39,54 11,64", RED_LIGHT, 0.45],
  ["66,44 94,34 97,48 69,57", RED_PALE, 0.4],
  ["0,64 20,57 22,69 0,75", RED_PALE, 0.3],

  // Bottom: red planes with blue cutting across them.
  ["0,170 100,156 100,200 0,200", RED],
  ["0,186 100,170 100,200 0,200", RED_MID, 0.9],
  ["0,163 100,148 100,155 0,170", RED_LIGHT, 0.5],
  ["0,200 31,200 4,157", RED_LIGHT, 0.38],
  ["70,200 100,200 100,150", RED_PALE, 0.32],
  ["18,138 49,128 53,148 22,156", RED_PALE, 0.36],
  ["0,176 42,160 46,172 4,189", NAVY, 0.68],
  ["52,150 94,134 98,147 56,163", NAVY_MID, 0.52],
  ["10,150 40,139 43,152 13,163", NAVY_LIGHT, 0.42],
  ["60,180 92,168 95,182 63,194", BLUE_PALE, 0.38],
  ["0,144 22,136 24,148 0,155", NAVY_LIGHT, 0.3],

  ["6,72 27,65 29,79 8,85", RED_PALE, 0.3],
  ["74,118 95,111 97,126 76,131", NAVY_LIGHT, 0.28],
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
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-white">
      <div className="hidden h-full w-full sm:block">
        <Field shards={WIDE} viewBox="0 0 160 100" />
      </div>
      <div className="h-full w-full sm:hidden">
        <Field shards={TALL} viewBox="0 0 100 200" />
      </div>
    </div>
  );
}
