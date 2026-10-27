// Every static path of the tender-box figure, computed once (on the server for the art).
import {
  corners,
  cylinder,
  depthOf,
  haloOf,
  insetPlan,
  knurl,
  lineOnTop,
  pathOf,
  planOutline,
  pointsAt,
  radialTicks,
  ring,
  rise,
  segment,
  sideArc,
  sideMatrix,
  sideSeam,
  slabOf,
  type Flat,
  type Plan,
  type Plane,
  type Point3,
} from "@/components/iso/iso-kit";

import {
  angleOf,
  at,
  BEZEL,
  BEZEL_H,
  BEZEL_TOP,
  BOX,
  BOX_H,
  BOX_Z,
  DETENT_R,
  DETENTS,
  DIAL,
  DIAL_H,
  DIAL_R,
  DIAL_TOP,
  DIAL_Z,
  ENVELOPE_D,
  ENVELOPE_FACE_Y,
  ENVELOPE_H,
  ENVELOPE_W,
  ENVELOPE_X,
  ENVELOPE_Y,
  FOOT_H,
  FRONT_Y,
  KNOB,
  KNOB_H,
  KNOB_R,
  KNOB_TOP,
  KNOB_Z,
  LID,
  LID_H,
  LID_TOP,
  LID_Z,
  P,
  PEDESTAL_R,
  PEDESTAL_TOP,
  PLATE,
  PLATE_H,
  SCALE_HIGH,
  SCALE_LOW,
  SEATED,
  SIDE_X,
  SKID_H,
  SLOT,
} from "./view";

const byDepth = (points: Plane[]) => [...points].sort((a, b) => depthOf([a[0], a[1], 0], P) - depthOf([b[0], b[1], 0], P));
const rowOf = (from: number, to: number, step: number, place: (v: number) => Point3) => {
  const out: Point3[] = [];
  for (let v = from; v <= to + 1e-6; v += step) out.push(place(v));
  return pointsAt(out, P);
};
const join = (paths: string[]) => paths.join("");

// ---------------------------------------------------------------- base plate
const BASE_Z = -PLATE_H;
const LABEL: Plan = { x: -10, y: 49, w: 36, d: 8, r: 1.2 };
export const BASE_ART = {
  halo: haloOf(PLATE, BASE_Z - FOOT_H, PLATE_H, P),
  feet: byDepth(corners(PLATE, 18)).map(([x, y]) => [
    cylinder(x, y, 7.4, BASE_Z - FOOT_H, 1.6, P, 28),
    cylinder(x, y, 5.6, BASE_Z - FOOT_H + 1.6, FOOT_H - 1.6, P, 28),
  ]),
  slab: slabOf(PLATE, BASE_Z, PLATE_H, P, 8, 1.6),
  groove: planOutline(insetPlan(PLATE, 5), 0, P),
  screwRings: join(corners(PLATE, 10).map(([x, y]) => ring(x, y, 2.2, 0, P, 16))),
  screws: pointsAt(corners(PLATE, 10).map(([x, y]) => [x, y, 0] as Point3), P),
  label: slabOf(LABEL, 0, 0.8, P, 4),
  labelInset: planOutline(insetPlan(LABEL, 1.6), 0.8, P),
  labelRules: join([
    lineOnTop([LABEL.x + 5, LABEL.y + 2.6], [LABEL.x + 24, LABEL.y + 2.6], 0.8, P),
    lineOnTop([LABEL.x + 5, LABEL.y + 4.2], [LABEL.x + 29, LABEL.y + 4.2], 0.8, P),
    lineOnTop([LABEL.x + 5, LABEL.y + 5.8], [LABEL.x + 17, LABEL.y + 5.8], 0.8, P),
  ]),
  labelScrews: pointsAt(
    [
      [LABEL.x + 2.2, LABEL.y + LABEL.d / 2, 0.8],
      [LABEL.x + LABEL.w - 2.2, LABEL.y + LABEL.d / 2, 0.8],
    ],
    P,
  ),
};

// ---------------------------------------------------------------- the tender box
const SKIDS: Plan[] = [
  { x: BOX.x + 5, y: BOX.y + 4, w: BOX.w - 10, d: 7, r: 1.4 },
  { x: BOX.x + 5, y: BOX.y + BOX.d - 11, w: BOX.w - 10, d: 7, r: 1.4 },
];
const HASP_X = -26;
const HANDLE_Y = [-34, -10];
const SIDE_PLATES: Plan[] = HANDLE_Y.map((y) => ({ x: SIDE_X, y: y - 2, w: 2.4, d: 4, r: 0.8 }));
const SIDE_BAR: Plan = { x: SIDE_X + 2.4, y: HANDLE_Y[0] - 2.4, w: 2.6, d: HANDLE_Y[1] - HANDLE_Y[0] + 4.8, r: 1.3 };
const FRONT_LABEL: Plan = { x: -74, y: FRONT_Y, w: 36, d: 0.8, r: 0.5 };
const FRONT_LABEL_Z: [number, number] = [31, 43];

export const BOX_ART = {
  halo: haloOf(insetPlan(BOX, 3), 0, 1, P),
  skids: SKIDS.map((plan) => slabOf(plan, 0, SKID_H, P, 3, 0.4)),
  body: slabOf(BOX, BOX_Z, BOX_H, P, 4, 0.8),
  // Two welded reinforcing bands round the body, ending on its silhouette.
  bands: join([sideSeam(BOX, BOX_Z + 10, P, 4), sideSeam(BOX, BOX_Z + BOX_H - 9, P, 4)]),
  // Rivet rows just above the bottom band, on both visible faces.
  rivets: [
    ...rowOf(BOX.x + 6, SIDE_X - 6, 8, (x) => [x, FRONT_Y, BOX_Z + 5]),
    ...rowOf(BOX.y + 6, FRONT_Y - 6, 8, (y) => [SIDE_X, y, BOX_Z + 5]),
  ],
  // Side handle: two plates on the +x face and a bar across them.
  sidePlates: SIDE_PLATES.map((plan) => slabOf(plan, 34, 4, P, 2, 0.3)),
  sideBar: slabOf(SIDE_BAR, 33.4, 3.6, P, 3, 0.4),
  // Engraved label plate on the +y face: the figure's one word.
  frontLabel: slabOf(FRONT_LABEL, FRONT_LABEL_Z[0], FRONT_LABEL_Z[1] - FRONT_LABEL_Z[0], P, 2),
  frontLabelText: sideMatrix([FRONT_LABEL.x + 18, FRONT_Y + FRONT_LABEL.d], FRONT_LABEL_Z[0] + 4, P, "left"),
  frontLabelRivets: pointsAt(
    [
      [FRONT_LABEL.x + 2.2, FRONT_Y + FRONT_LABEL.d, FRONT_LABEL_Z[1] - 2.2],
      [FRONT_LABEL.x + FRONT_LABEL.w - 2.2, FRONT_Y + FRONT_LABEL.d, FRONT_LABEL_Z[1] - 2.2],
      [FRONT_LABEL.x + 2.2, FRONT_Y + FRONT_LABEL.d, FRONT_LABEL_Z[0] + 2.2],
      [FRONT_LABEL.x + FRONT_LABEL.w - 2.2, FRONT_Y + FRONT_LABEL.d, FRONT_LABEL_Z[0] + 2.2],
    ],
    P,
  ),
  // Hasp: a staple plate on the body and a strap hanging from the lid over it.
  haspPlate: slabOf({ x: HASP_X - 4.5, y: FRONT_Y, w: 9, d: 1.2, r: 0.6 }, 30, 14, P, 2, 0.3),
  lid: slabOf(LID, LID_Z, LID_H, P, 4, 0.8),
  lidGroove: planOutline(insetPlan(LID, 4), LID_TOP, P, 4),
  lidScrews: pointsAt(corners(LID, 5.5).map(([x, y]) => [x, y, LID_TOP] as Point3), P),
  haspStrap: slabOf({ x: HASP_X - 4, y: FRONT_Y + 2, w: 8, d: 1.2, r: 0.6 }, 38, LID_Z + 3 - 38, P, 2, 0.3),
  haspRivets: pointsAt(
    [
      [HASP_X, FRONT_Y + 3.2, LID_Z + 0.8],
      [HASP_X, FRONT_Y + 3.2, 44],
    ],
    P,
  ),
  // Padlock through the hasp: body, shackle (a flat arch in the y plane) and keyhole.
  lockBody: slabOf({ x: HASP_X - 6.5, y: FRONT_Y + 3.2, w: 13, d: 5, r: 1.6 }, 25, 12, P, 3, 0.5),
  shackle: archOf([HASP_X, FRONT_Y + 5.7, 37], 4.4, 2.9, 5),
  keyhole: rise([HASP_X, FRONT_Y + 8.2], 28.4, 31.4, P),
  keyholeDot: pointsAt([[HASP_X, FRONT_Y + 8.2, 32]], P),
  // Raised bezel round the slot, the dark slot, and the bezel's two screws.
  bezel: slabOf(BEZEL, LID_TOP, BEZEL_H, P, 6, 0.4),
  slot: planOutline(SLOT, BEZEL_TOP, P, 6),
  bezelScrews: pointsAt(
    [
      [BEZEL.x + 2.4, SLOT.y + SLOT.d / 2, BEZEL_TOP],
      [BEZEL.x + BEZEL.w - 2.4, SLOT.y + SLOT.d / 2, BEZEL_TOP],
    ],
    P,
  ),
};

/** A flat arch (padlock shackle) standing in the plane y = centre[1], legs going down `legs` from its centre height. */
function archOf([cx, y, cz]: Point3, outer: number, inner: number, legs: number) {
  const pts: Flat[] = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = Math.PI - (i / n) * Math.PI;
    pts.push(at([cx + Math.cos(t) * outer, y, cz + Math.sin(t) * outer]));
  }
  pts.push(at([cx + outer, y, cz - legs]), at([cx + inner, y, cz - legs]));
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI;
    pts.push(at([cx + Math.cos(t) * inner, y, cz + Math.sin(t) * inner]));
  }
  pts.push(at([cx - inner, y, cz - legs]), at([cx - outer, y, cz - legs]));
  return pathOf(pts, true);
}

// ---------------------------------------------------------------- sealed envelopes
// Built seated in the slot; the live code lifts and fades the ones that aren't bids.
export const ENVELOPES = ENVELOPE_X.map((cx) => {
  const x0 = cx - ENVELOPE_W / 2;
  const x1 = cx + ENVELOPE_W / 2;
  const top = SEATED + ENVELOPE_H;
  const y = ENVELOPE_FACE_Y;
  return {
    body: slabOf({ x: x0, y: ENVELOPE_Y, w: ENVELOPE_W, d: ENVELOPE_D, r: 0.3 }, SEATED, ENVELOPE_H, P, 2),
    // The flap: two folds from the top corners to the seal.
    flap: join([segment([x0, y, top], [cx, y, top - 8.5], P), segment([cx, y, top - 8.5], [x1, y, top], P)]),
    seal: pointsAt([[cx, y, top - 8.5]], P),
    // Two address lines (printed text, so they may stop on the face).
    address: join([segment([cx - 5, y, top - 11.2], [cx + 6, y, top - 11.2], P), segment([cx - 5, y, top - 13.2], [cx + 2, y, top - 13.2], P)]),
  };
});

/** Screen region above the bezel in the envelopes' face plane: what is inside the box is clipped away. */
export const ENVELOPE_CLIP = (() => {
  const a = at([SLOT.x - 8, ENVELOPE_FACE_Y, BEZEL_TOP]);
  const b = at([SLOT.x + SLOT.w + 8, ENVELOPE_FACE_Y, BEZEL_TOP]);
  return pathOf([a, b, [b[0], b[1] - 600], [a[0], a[1] - 600]], true);
})();

// ---------------------------------------------------------------- gauge
const [DX, DY] = DIAL;
const TICK_R = DIAL_R - 3.2;
const ticks = radialTicks(DX, DY, TICK_R, 20, 5, DIAL_TOP, [1.4, 3], P, angleOf(SCALE_LOW), angleOf(SCALE_HIGH) - angleOf(SCALE_LOW));
const zero = angleOf(0);
export const GAUGE_ART = {
  halo: haloOf({ x: DX - DIAL_R, y: DY - DIAL_R, w: DIAL_R * 2, d: DIAL_R * 2, r: DIAL_R }, 0, 1, P),
  collar: cylinder(DX, DY, 8.5, 0, 2.4, P, 36, 0.4),
  pedestal: cylinder(DX, DY, PEDESTAL_R, 2.4, PEDESTAL_TOP - 2.4, P, 28),
  pedestalSeam: sideArc(DX, DY, PEDESTAL_R, 12, P, 16),
  puck: cylinder(DX, DY, DIAL_R, DIAL_Z, DIAL_H, P, 72, 0.8),
  knurl: knurl(DX, DY, DIAL_R, DIAL_TOP - 3.4, DIAL_TOP, 96, P, 0.3),
  band: sideArc(DX, DY, DIAL_R, DIAL_TOP - 3.4, P, 48),
  bezel: ring(DX, DY, DIAL_R - 2.2, DIAL_TOP, P, 72),
  minor: ticks.minor,
  major: ticks.major,
  // The estimate: a longer mark in the strongest tone.
  estimate: lineOnTop([DX + Math.sin(zero) * (TICK_R - 5), DY - Math.cos(zero) * (TICK_R - 5)], [DX + Math.sin(zero) * TICK_R, DY - Math.cos(zero) * TICK_R], DIAL_TOP, P),
  crownNeck: slabOf({ x: DX + DIAL_R - 1, y: DY - 2.4, w: 5, d: 4.8, r: 1.2 }, DIAL_Z + 1.6, 4.8, P, 3),
  crown: slabOf({ x: DX + DIAL_R + 3.6, y: DY - 3.4, w: 2.8, d: 6.8, r: 1.3 }, DIAL_Z + 0.8, 6.4, P, 3, 0.3),
  hub: ring(DX, DY, 1.7, DIAL_TOP, P, 16),
};

// ---------------------------------------------------------------- knob
const [KX, KY] = KNOB;
const DISC_R = DETENT_R + 2.6;
export const KNOB_ART = {
  disc: cylinder(KX, KY, DISC_R, 0, 1.2, P, 56, 0.4),
  // Each detent is engraved with as many dots as bids: one, two, three.
  detentDots: DETENTS.flatMap((angle, index) =>
    Array.from({ length: index + 1 }, (_, i) => {
      const r = 10.4 + i * 1.9;
      return at([KX + Math.sin(angle) * r, KY - Math.cos(angle) * r, 1.2]);
    }),
  ),
  collar: cylinder(KX, KY, 8.2, 1.2, KNOB_Z - 1.2, P, 40),
  knob: cylinder(KX, KY, KNOB_R, KNOB_Z, KNOB_H, P, 40, 0.6),
  // Full height: each knurl line ends on the knob's bottom edge and top rim.
  knurl: knurl(KX, KY, KNOB_R, KNOB_Z, KNOB_TOP, 34, P),
  cap: ring(KX, KY, KNOB_R - 1.5, KNOB_TOP, P, 32),
};
