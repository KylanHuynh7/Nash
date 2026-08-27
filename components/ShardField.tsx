/**
 * The landing page's backdrop: one plane in the shield palette, broken.
 *
 * The trick is that the fractures are drawn *last*, as continuous white slivers
 * running edge to edge across the whole canvas. Every colour underneath gets
 * cut by the same lines, so neighbouring fragments share edges and the thing
 * reads as one shattered surface. Independently rotated rectangles do not —
 * they read as confetti, however many you scatter.
 *
 * The colour division is slanted rather than a vertical corridor, and neither
 * side keeps to its own half: red wedges drive into the blue and blue into the
 * red, along the same diagonals the fractures run on.
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
const CRACK = "#ffffff";

type Shard = [points: string, fill: string, opacity?: number];

/** Wide window: 160x100, one unit ≈ 8px at 1280. Content sits in x 44-116. */
const WIDE: Shard[] = [
  // --- Blue mass, left. Every edge leans the same way, so it reads as one
  // plane rather than a stack of bars.
  ["0,0 48,0 18,100 0,100", NAVY_DEEP],
  ["0,0 38,0 12,100 0,100", NAVY],
  ["10,0 30,0 4,100 0,100", NAVY_DEEP, 0.85],
  ["30,0 44,0 15,100 6,100", NAVY_MID, 0.75],
  ["40,0 50,0 21,100 15,100", NAVY_LIGHT, 0.6],
  ["46,0 52,0 24,100 20,100", BLUE_PALE, 0.45],
  // --- Red driving into the blue, on a crossing diagonal.
  ["0,6 30,0 38,18 4,27", RED, 0.8],
  ["0,54 34,38 40,50 2,68", RED_MID, 0.55],
  ["14,74 40,60 45,74 18,90", RED_LIGHT, 0.45],
  ["0,88 22,78 26,100 6,100", RED_PALE, 0.4],

  // --- Red mass, right. Leaning the other way so the two sides collide.
  ["112,0 160,0 160,100 132,100", RED],
  ["124,0 160,0 160,100 142,100", RED_MID, 0.9],
  ["140,0 160,0 160,100 152,100", RED, 0.8],
  ["106,0 118,0 140,100 130,100", RED_LIGHT, 0.5],
  ["100,0 108,0 128,100 122,100", RED_PALE, 0.4],
  // --- Blue driving into the red.
  ["126,4 158,0 160,16 132,26", NAVY, 0.72],
  ["112,44 150,28 156,42 118,60", NAVY_MID, 0.55],
  ["132,70 160,58 160,76 138,86", NAVY_LIGHT, 0.45],
  ["104,84 128,74 132,94 110,100", BLUE_PALE, 0.35],

  // --- Fractures. A crack fans from an impact and some of them stop partway;
  // two perpendicular families spanning edge to edge read as a grid, which is
  // what the first attempt at this looked like. Opaque, because a translucent
  // sliver reads as tape laid over the art rather than a break in it.
  ["-8.7,-5.6 69.8,110.1 70.2,109.9 -7.3,-6.4", CRACK],
  ["-8.7,-5.6 49.8,112.1 50.2,111.9 -7.3,-6.4", CRACK],
  ["-8.8,-5.8 27.8,115.1 28.2,114.9 -7.2,-6.2", CRACK],
  ["-8.6,-5.5 77.1,84.3 77.4,84.1 -7.4,-6.5", CRACK],
  ["-8.8,-5.9 13.8,118.0 14.2,118.0 -7.2,-6.1", CRACK],
  ["-8.5,-5.4 68.7,50.6 68.9,50.2 -7.5,-6.6", CRACK],
  ["171.3,-4.4 95.8,107.9 96.2,108.1 172.7,-3.6", CRACK],
  ["171.3,-4.3 119.8,109.9 120.2,110.1 172.7,-3.7", CRACK],
  ["171.2,-4.2 139.8,111.9 140.2,112.1 172.8,-3.8", CRACK],
  ["171.4,-4.6 95.4,73.9 95.7,74.1 172.6,-3.4", CRACK],
  ["171.2,-4.1 157.8,114.0 158.2,114.0 172.8,-3.9", CRACK],
  ["171.6,-4.7 108.1,38.7 108.3,39.1 172.4,-3.3", CRACK],
];

/** Phone: 100x200. Content sits in y 70-155. */
const TALL: Shard[] = [
  ["0,0 100,0 100,26 0,46", NAVY_DEEP],
  ["0,0 100,0 100,14 0,30", NAVY],
  ["0,0 100,0 100,6 0,16", NAVY_DEEP, 0.85],
  ["0,46 100,26 100,36 0,58", NAVY_MID, 0.7],
  ["0,58 100,36 100,44 0,66", NAVY_LIGHT, 0.5],
  ["0,66 100,44 100,50 0,73", BLUE_PALE, 0.35],
  ["0,10 62,0 70,18 4,32", RED, 0.7],
  ["30,34 96,14 100,30 36,52", RED_MID, 0.5],
  ["0,50 44,34 48,48 2,66", RED_LIGHT, 0.4],
  ["56,52 100,36 100,50 60,66", RED_PALE, 0.35],

  ["0,158 100,138 100,200 0,200", RED],
  ["0,174 100,152 100,200 0,200", RED_MID, 0.9],
  ["0,188 100,168 100,200 0,200", RED, 0.8],
  ["0,148 100,126 100,138 0,158", RED_LIGHT, 0.5],
  ["0,138 100,116 100,126 0,148", RED_PALE, 0.35],
  ["0,168 64,146 72,164 6,188", NAVY, 0.66],
  ["36,196 100,170 100,186 44,200", NAVY_MID, 0.5],
  ["0,132 46,114 50,130 2,150", NAVY_LIGHT, 0.42],
  ["58,124 100,108 100,124 62,140", BLUE_PALE, 0.32],

  ["-6.7,-7.6 59.8,120.1 60.2,119.9 -5.3,-8.4", CRACK],
  ["-6.8,-7.8 37.8,140.1 38.2,139.9 -5.2,-8.2", CRACK],
  ["-6.6,-7.5 69.1,75.3 69.3,75.1 -5.4,-8.5", CRACK],
  ["-6.8,-7.9 17.8,160.0 18.2,160.0 -5.2,-8.1", CRACK],
  ["-6.5,-7.4 54.4,36.2 54.6,35.8 -5.5,-8.6", CRACK],
  ["108.7,207.6 40.2,79.9 39.8,80.1 107.3,208.4", CRACK],
  ["108.8,207.8 64.2,59.9 63.8,60.1 107.2,208.2", CRACK],
  ["108.6,207.5 16.1,103.9 15.9,104.1 107.4,208.5", CRACK],
  ["108.8,207.8 87.2,138.9 86.8,139.1 107.2,208.2", CRACK],
  ["108.5,207.3 -3.9,127.8 -4.1,128.2 107.5,208.7", CRACK],
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
