// World layout and camera for the tender-box figure. World units are about one pixel of the real
// thing: x and y on the floor, z up. The default camera looks from the +x / +y corner, so the
// box's +x (screen right) and +y (screen left) faces are the ones on show.
import { boxCorners, fitProjection, iso, type Plan, type Point3 } from "@/components/iso/iso-kit";

export const WIDTH = 600;
export const HEIGHT = 380;

// Base plate on four feet.
export const PLATE: Plan = { x: -100, y: -64, w: 204, d: 126, r: 9 };
export const PLATE_H = 9;
export const FOOT_H = 5;

// The tender box: two skids, a steel body, a lid that overhangs it by 2, a raised bezel round the slot.
export const SKID_H = 3;
export const BOX: Plan = { x: -80, y: -46, w: 102, d: 60, r: 3 };
export const BOX_Z = SKID_H;
export const BOX_H = 50;
export const LID: Plan = { x: BOX.x - 2, y: BOX.y - 2, w: BOX.w + 4, d: BOX.d + 4, r: 4 };
export const LID_Z = BOX_Z + BOX_H;
export const LID_H = 5;
export const LID_TOP = LID_Z + LID_H;
export const BEZEL_H = 1.4;
export const BEZEL_TOP = LID_TOP + BEZEL_H;
export const SLOT: Plan = { x: -67, y: -19, w: 74, d: 6, r: 3 };
export const BEZEL: Plan = { x: SLOT.x - 4, y: SLOT.y - 4, w: SLOT.w + 8, d: SLOT.d + 8, r: 6 };
export const FRONT_Y = BOX.y + BOX.d; // the +y face of the body
export const SIDE_X = BOX.x + BOX.w; // the +x face of the body

// Sealed envelopes standing in the slot, one per company that bid. Their faces are on the +y side.
export const ENVELOPE_W = 18;
export const ENVELOPE_D = 1.6;
export const ENVELOPE_H = 24;
export const ENVELOPE_Y = SLOT.y + SLOT.d / 2 - ENVELOPE_D / 2;
export const ENVELOPE_FACE_Y = ENVELOPE_Y + ENVELOPE_D;
export const ENVELOPE_X = [-56, -33, -10];
export const SEATED = BEZEL_TOP - 9; // bottom of a seated envelope: 9 units inside the slot
export const LIFT = 34; // how far a withdrawn envelope rises as it fades

// The gauge: a face-up dial on a pedestal, reading the winning price against the estimate.
export const DIAL: [number, number] = [64, 22];
export const DIAL_R = 22;
export const PEDESTAL_R = 4.6;
export const PEDESTAL_TOP = 24;
export const DIAL_Z = PEDESTAL_TOP;
export const DIAL_H = 8;
export const DIAL_TOP = DIAL_Z + DIAL_H;

// Dial scale: −30% (cheaper, screen left) to +10%. Angle 0 points to −y and grows toward +x, so
// screen-up is −45°; each percent turns the needle 3°, cheaper prices turning it left.
export const SCALE_LOW = -30;
export const SCALE_HIGH = 10;
export const DEG_PER_PCT = 3;
export const angleOf = (pct: number) => ((-45 + Math.max(SCALE_LOW - 2, Math.min(SCALE_HIGH + 2, pct)) * DEG_PER_PCT) * Math.PI) / 180;

// The knob that sets how many companies bid: three detents, turning clockwise as bids rise.
export const KNOB: [number, number] = [-44, 40];
export const KNOB_R = 6.4;
export const KNOB_Z = 2.4;
export const KNOB_H = 7;
export const KNOB_TOP = KNOB_Z + KNOB_H;
export const DETENT_R = 13.5;
export const DETENTS = [-105, -45, 15].map((deg) => (deg * Math.PI) / 180); // 1, 2, 3+ bids

const ENVELOPE_TOP = SEATED + ENVELOPE_H;

export const P = fitProjection(
  [
    ...boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    ...boxCorners(LID, LID_Z, BEZEL_TOP),
    [ENVELOPE_X[0] - ENVELOPE_W / 2, ENVELOPE_FACE_Y, ENVELOPE_TOP + 4],
    [ENVELOPE_X[2] + ENVELOPE_W / 2, ENVELOPE_FACE_Y, ENVELOPE_TOP + 4],
  ] as Point3[],
  WIDTH,
  HEIGHT,
  { pad: 26 },
);

export const at = (point: Point3) => iso(point, P);
