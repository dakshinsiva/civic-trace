// Server component: the static parts as JSX, handed to the live component as element props.
// Every element prop's root has a stable key (see the kit's React notes on the large-page trap).
import * as React from "react";

import { Dots, FaceText, Line, Solid } from "@/components/iso/react/draw";

import { BASE_ART, BOX_ART, ENVELOPE_CLIP, ENVELOPES, GAUGE_ART, KNOB_ART } from "./geometry";
import { TenderBoxLive } from "./live";
import type { Competition } from "./model";

const BASE = (
  <g key="base">
    <path className="iso-halo" d={BASE_ART.halo} />
    {BASE_ART.feet.map((parts, i) => (
      <g key={i}>
        <Solid paths={parts[0]} tone="lo" />
        <Solid paths={parts[1]} tone="mid" />
      </g>
    ))}
    <Solid paths={BASE_ART.slab} tone="mid" />
    <Line d={BASE_ART.groove} tone="lo" />
    <Line d={BASE_ART.screwRings} tone="lo" />
    <Dots points={BASE_ART.screws} size={0.5} tone="mid" />
    <Solid paths={BASE_ART.label} tone="lo" crease="none" />
    <Line d={BASE_ART.labelInset} tone="faint" />
    <Line d={BASE_ART.labelRules} tone="lo" free />
    <Dots points={BASE_ART.labelScrews} size={0.45} tone="mid" />
  </g>
);

const BOX = (
  <g key="box">
    <path className="iso-halo" d={BOX_ART.halo} />
    {BOX_ART.skids.map((paths, i) => (
      <Solid key={i} paths={paths} tone="lo" />
    ))}
    <Solid paths={BOX_ART.body} tone="mid" inner={<Line d={BOX_ART.bands} tone="faint" />} />
    <Dots points={BOX_ART.rivets} size={0.45} tone="mid" />
    {BOX_ART.sidePlates.map((paths, i) => (
      <Solid key={i} paths={paths} tone="mid" />
    ))}
    <Solid paths={BOX_ART.sideBar} tone="mid" />
    <Solid paths={BOX_ART.frontLabel} tone="lo" crease="none" />
    <FaceText transform={BOX_ART.frontLabelText} size={6.2} tone="hi" anchor="middle">
      TENDER
    </FaceText>
    <Dots points={BOX_ART.frontLabelRivets} size={0.42} tone="mid" />
    <Solid paths={BOX_ART.haspPlate} tone="mid" />
    <Solid paths={BOX_ART.lid} tone="mid" />
    <Line d={BOX_ART.lidGroove} tone="faint" />
    <Dots points={BOX_ART.lidScrews} size={0.5} tone="mid" />
    <Solid paths={BOX_ART.haspStrap} tone="mid" />
    <Dots points={BOX_ART.haspRivets} size={0.42} tone="mid" />
    <path className="ct-shackle" d={BOX_ART.shackle} />
    <Solid paths={BOX_ART.lockBody} tone="hi" />
    <Line d={BOX_ART.keyhole} tone="mid" />
    <Dots points={BOX_ART.keyholeDot} size={0.7} tone="mid" />
    <Solid paths={BOX_ART.bezel} tone="mid" />
    <path className="ct-slot" d={BOX_ART.slot} />
    <Dots points={BOX_ART.bezelScrews} size={0.5} tone="mid" />
  </g>
);

const ENVELOPE_PARTS = ENVELOPES.map((e, i) => (
  <g key={`envelope-${i}`}>
    <Solid paths={e.body} tone="hi" />
    <Line d={e.flap} tone="mid" />
    <Line d={e.address} tone="lo" free />
    <Dots points={e.seal} size={1.25} tone="hi" />
  </g>
));

const KNOB = (
  <g key="knob">
    <Solid paths={KNOB_ART.disc} tone="lo" />
    <Dots points={KNOB_ART.detentDots} size={0.55} tone="hi" />
    <Solid paths={KNOB_ART.collar} tone="mid" />
    <Solid paths={KNOB_ART.knob} tone="hi" crease="lo" />
    <Line d={KNOB_ART.knurl} tone="lo" />
    <Line d={KNOB_ART.cap} tone="faint" />
  </g>
);

const GAUGE = (
  <g key="gauge">
    <path className="iso-halo" d={GAUGE_ART.halo} />
    <Solid paths={GAUGE_ART.collar} tone="lo" />
    <Solid paths={GAUGE_ART.pedestal} tone="mid" crease="none" inner={<Line d={GAUGE_ART.pedestalSeam} tone="faint" />} />
    <Solid paths={GAUGE_ART.puck} tone="hi" crease="lo" inner={<Line d={GAUGE_ART.band} tone="faint" />} />
    <Line d={GAUGE_ART.knurl} tone="lo" />
    <Line d={GAUGE_ART.bezel} tone="lo" />
    <Line d={GAUGE_ART.minor} tone="lo" />
    <Line d={GAUGE_ART.major} tone="mid" />
    <Line d={GAUGE_ART.estimate} tone="hi" />
    <Solid paths={GAUGE_ART.crownNeck} tone="mid" />
    <Solid paths={GAUGE_ART.crown} tone="mid" />
    <Line d={GAUGE_ART.hub} tone="mid" />
  </g>
);

export function TenderBoxArt({ data, label }: { data: Competition; label: string }) {
  return <TenderBoxLive data={data} label={label} base={BASE} box={BOX} envelopes={ENVELOPE_PARTS} envelopeClip={ENVELOPE_CLIP} knob={KNOB} gauge={GAUGE} />;
}
