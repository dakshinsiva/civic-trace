// The truth behind the figure: the typical (median) winning price against the government's
// estimate, for contracts with 1, 2 and 3+ companies competing, from the data release. The
// needle, the readout, the screen-reader text and the caption all read from here.

export type Group = { med: number; n: number };
export type Competition = { 1: Group; 2: Group; 3: Group };
export type Bids = 1 | 2 | 3;

export const BIDS_LABEL: Record<Bids, string> = { 1: "1 bid", 2: "2 bids", 3: "3+ bids" };
const COMPANIES: Record<Bids, string> = { 1: "Only one company bid", 2: "Two companies bid", 3: "Three or more companies bid" };

const num = (n: number) => n.toLocaleString("en-IN");

/** −18.0% · +3.4% · 0.0% (a true minus sign, one decimal). */
export const signed = (pct: number) => {
  const r = Math.round(pct * 10) / 10;
  return `${r < 0 ? "−" : r > 0 ? "+" : ""}${Math.abs(r).toFixed(1)}%`;
};

/** "18% below the estimate", "right at the estimate", "3% above the estimate". */
export const vsEstimate = (pct: number) => {
  const r = Math.round(Math.abs(pct));
  return r === 0 ? "right at the estimate" : `${r}% ${pct < 0 ? "below" : "above"} the estimate`;
};

/** The card's readout, from where the needle is right now (the contract counts are in the caption). */
export const readoutOf = (bids: Bids, needle: number) => `${BIDS_LABEL[bids]} · ${signed(needle)} vs estimate`;

/** What a screen reader hears when the setting changes (never from the frame loop). */
export const valueTextOf = (bids: Bids, data: Competition) =>
  `${COMPANIES[bids]}: the typical winning price was ${vsEstimate(data[bids].med)}, across ${num(data[bids].n)} contracts.`;

export const captionOf = (data: Competition) =>
  `A tender box with a price gauge. Each sealed envelope in the slot is a company that bid; the gauge reads the typical winning price against the government's own estimate, for Bengaluru public works contracts with that many bidders: ${vsEstimate(data[1].med)} with one, ${vsEstimate(data[2].med)} with two, and ${vsEstimate(data[3].med)} with three or more (${num(data[1].n + data[2].n + data[3].n)} contracts with a published bidder count).`;
