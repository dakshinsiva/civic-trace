"use client";

import * as React from "react";

import { Dots, IsoFigure } from "@/components/iso/react/draw";
import { follow, spring, useInView, useLoop, useReadout, type Spring } from "@/components/iso/react/live";

import { envelopeOpacity, envelopeShift, knobAngle, needleAt, pointerAt } from "./frame";
import { readoutOf, valueTextOf, type Bids, type Competition } from "./model";
import { at, DIAL, DIAL_TOP, HEIGHT, KNOB, KNOB_TOP, WIDTH } from "./view";

const TOUR: Bids[] = [1, 2, 3];
const TOUR_START = 1.4; // seconds in view before the tour begins
const TOUR_STEP = 3.4; // seconds on each setting
const RESUME = 3.6; // seconds after the last input before the tour resumes
const HUB = [at([DIAL[0], DIAL[1], DIAL_TOP + 0.2])];
const KNOB_SCREW = [at([KNOB[0], KNOB[1], KNOB_TOP + 0.05])];

type Props = {
  data: Competition;
  label: string;
  base: React.ReactNode;
  box: React.ReactNode;
  envelopes: React.ReactNode[];
  envelopeClip: string;
  knob: React.ReactNode;
  gauge: React.ReactNode;
};

export function TenderBoxLive({ data, label, base, box, envelopes, envelopeClip, knob, gauge }: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const visible = useInView(anchor);
  const clipId = `ct-env-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const needle = React.useRef<SVGPathElement>(null);
  const pointer = React.useRef<SVGPathElement>(null);
  const envs = React.useRef<(SVGGElement | null)[]>([]);
  // Rest pose (rendered on the server too): three bids, every envelope seated.
  const state = React.useRef({
    bids: 3 as Bids,
    knob: 3,
    needle: { at: data[3].med, rate: 0 } as Spring,
    seats: [1, 1, 1],
    clock: 0,
    idle: RESUME,
    engaged: false,
  });
  const [bids, setBidsState] = React.useState<Bids>(3);

  const setBids = React.useCallback((b: Bids) => {
    if (state.current.bids === b) return;
    state.current.bids = b;
    setBidsState(b);
  }, []);

  const kick = useLoop((dt, calm) => {
    const s = state.current;
    // Idle tour: drives the same target a reader would.
    if (!s.engaged) s.idle += dt;
    const touring = !calm && !s.engaged && s.idle >= RESUME;
    if (touring) {
      s.clock += dt;
      if (s.clock > TOUR_START) setBids(TOUR[Math.floor((s.clock - TOUR_START) / TOUR_STEP) % TOUR.length]);
    }
    s.knob = follow(s.knob, s.bids, dt, 0.22, calm);
    const still = spring(s.needle, data[s.bids].med, dt, 70, 9.5, calm);
    let seated = true;
    s.seats = s.seats.map((seat, i) => {
      const next = follow(seat, i < s.bids ? 1 : 0, dt, 0.26 + i * 0.07, calm);
      if (next !== (i < s.bids ? 1 : 0)) seated = false;
      return next;
    });
    needle.current?.setAttribute("d", needleAt(s.needle.at));
    pointer.current?.setAttribute("d", pointerAt(knobAngle(s.knob)));
    s.seats.forEach((seat, i) => {
      const g = envs.current[i];
      if (!g) return;
      g.setAttribute("transform", envelopeShift(seat));
      g.setAttribute("opacity", String(envelopeOpacity(seat)));
    });
    say(readoutOf(s.bids, s.needle.at));
    return touring || !(still && seated && s.knob === s.bids);
  }, visible);

  // Input: hover across the figure picks 1, 2 or 3 bids; a tap steps to the next; keys set it.
  const engage = () => {
    state.current.engaged = true;
    state.current.idle = 0;
    kick();
  };
  const release = () => {
    state.current.engaged = false;
    state.current.idle = 0;
    state.current.clock = TOUR_START + (state.current.bids - 1) * TOUR_STEP; // resume from the current setting
    kick();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const box = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - box.left) / box.width;
    engage();
    setBids(f < 1 / 3 ? 1 : f < 2 / 3 ? 2 : 3);
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    engage();
    setBids(((state.current.bids % 3) + 1) as Bids);
    state.current.engaged = false; // a tap doesn't hold the figure: the tour resumes after RESUME
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const b = state.current.bids;
    const next: Bids | null =
      e.key === "1" || e.key === "Home" ? 1
      : e.key === "2" ? 2
      : e.key === "3" || e.key === "End" ? 3
      : e.key === "ArrowRight" || e.key === "ArrowUp" ? (Math.min(3, b + 1) as Bids)
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? (Math.max(1, b - 1) as Bids)
      : null;
    if (next == null) return;
    e.preventDefault();
    engage();
    setBids(next);
  };

  return (
    <div
      ref={anchor}
      className="ct-tenderbox"
      tabIndex={0}
      role="slider"
      aria-label="Companies bidding for a contract: hover across the figure, tap it, or press 1, 2 or 3"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={bids}
      aria-valuetext={valueTextOf(bids, data)}
      onPointerMove={onPointerMove}
      onPointerLeave={(e) => e.pointerType === "mouse" && release()}
      onPointerDown={onPointerDown}
      onFocus={engage}
      onBlur={release}
      onKeyDown={onKeyDown}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={label}>
        <defs>
          <clipPath id={clipId}>
            <path d={envelopeClip} />
          </clipPath>
        </defs>
        {base}
        {box}
        <g clipPath={`url(#${clipId})`}>
          {envelopes.map((envelope, i) => (
            <g
              key={i}
              ref={(el) => {
                envs.current[i] = el;
              }}
              transform={envelopeShift(1)}
              opacity={1}
            >
              {envelope}
            </g>
          ))}
        </g>
        {knob}
        <path ref={pointer} className="iso-line" data-tone="hi" d={pointerAt(knobAngle(3))} style={{ strokeWidth: 1.1 }} />
        <Dots points={KNOB_SCREW} size={0.8} tone="hi" />
        {gauge}
        <path ref={needle} className="iso-line" data-tone="lit" data-free="" d={needleAt(data[3].med)} style={{ strokeWidth: 1.2 }} />
        <Dots points={HUB} size={1.1} tone="hi" />
      </IsoFigure>
    </div>
  );
}
