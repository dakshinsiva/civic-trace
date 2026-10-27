// Paths and transforms for the parts that move, rebuilt each frame by the live component.
import { lineOnTop, translateAlong } from "@/components/iso/iso-kit";

import { angleOf, DETENTS, DIAL, DIAL_R, DIAL_TOP, KNOB, KNOB_R, KNOB_TOP, LIFT, P } from "./view";

const fine = (v: number) => Math.round(v * 100) / 100;

/** The gauge needle at a reading in percent against the estimate (tail behind the hub, tip near the ticks). */
export function needleAt(pct: number) {
  const a = angleOf(pct);
  const [x, y] = DIAL;
  const sx = Math.sin(a);
  const sy = -Math.cos(a);
  return lineOnTop([x - sx * 3.6, y - sy * 3.6], [x + sx * (DIAL_R - 4.8), y + sy * (DIAL_R - 4.8)], DIAL_TOP + 0.2, P);
}

/** The knob's pointer line at an angle (radians, the kit's convention: 0 points to −y). */
export function pointerAt(angle: number) {
  const [x, y] = KNOB;
  // From the centre screw out to the rim, so both ends land on something.
  return lineOnTop([x, y], [x + Math.sin(angle) * KNOB_R, y - Math.cos(angle) * KNOB_R], KNOB_TOP + 0.05, P);
}

/** Angle of the knob for a (fractional) number of bids, 1 to 3, between its detents. */
export function knobAngle(bids: number) {
  const t = Math.max(1, Math.min(3, bids)) - 1;
  const i = Math.min(1, Math.floor(t));
  return DETENTS[i] + (DETENTS[i + 1] - DETENTS[i]) * (t - i);
}

/** An envelope's lift for its state: 1 = seated in the slot, 0 = withdrawn above it. */
export const envelopeShift = (seat: number) => translateAlong(P, [0, 0, fine((1 - seat) * LIFT)]);

/** Opacity of an envelope for its state: fully there when seated, gone by the time it is withdrawn. */
export const envelopeOpacity = (seat: number) => {
  const s = Math.max(0, Math.min(1, seat));
  return fine(s * s * (3 - 2 * s));
};
