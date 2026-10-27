import "@/components/iso/iso.css";
import "./tenderbox.css";

import { Plate } from "@/components/iso/react/draw";

import { TenderBoxArt } from "./art";
import { captionOf, readoutOf, type Competition } from "./model";

/**
 * Fig 1 on the homepage: a tender box with a price gauge. Each sealed envelope in the slot is a
 * company that bid; the gauge reads the typical winning price against the estimate for that
 * many bidders, from the data release.
 */
export function TenderBoxFigure({ data }: { data: Competition }) {
  return (
    <div className="iso ct-iso">
      <Plate
        fig="Fig 1"
        title="Competition and price"
        hint="Hover · tap · 1–3"
        readout={readoutOf(3, data[3].med)}
        keys={[
          { mark: "raised", label: "A sealed bid: one company competing" },
          { mark: "lit", label: "Typical winning price against the estimate" },
        ]}
        caption={captionOf(data)}
      >
        <TenderBoxArt
          data={data}
          label="A steel tender box on a base plate, with sealed envelopes standing in the slot on its lid, a knob that sets how many companies bid, and a dial gauge whose needle reads the typical winning price against the government's estimate."
        />
      </Plate>
    </div>
  );
}
