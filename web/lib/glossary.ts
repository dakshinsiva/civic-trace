// Plain-language definitions shown on hover (<Term>) and on the glossary page.

export const GLOSSARY: Record<string, { term: string; plain: string }> = {
  tender: {
    term: "Tender",
    plain: "A public invitation from a government body asking companies to offer a price for a piece of work, such as repairing a road.",
  },
  estimate: {
    term: "Official estimate",
    plain:
      "What the government's engineers calculated the work should cost before inviting bids. On the portal it is called the 'Estimated Contract Value' (ECV).",
  },
  bid: {
    term: "Bid",
    plain: "The price a company offers to do the work.",
  },
  winning_bid: {
    term: "Winning price",
    plain: "The bid the government chose. Sometimes it is negotiated down afterwards; we compare the price as originally offered.",
  },
  price_round: {
    term: "Price round",
    plain:
      "Bids are opened in two steps. First officials check documents and qualifications; only companies that pass get their prices opened. We count the companies whose prices were opened.",
  },
  corrigendum: {
    term: "Corrigendum (change notice)",
    plain: "An official notice that changes something in a published tender, most often the deadline.",
  },
  retender: {
    term: "Re-tender",
    plain: "When a tender gets no acceptable bids, the same work is advertised again as a new 'call'.",
  },
  window: {
    term: "Time to bid",
    plain: "The number of days between a tender being published and the deadline for bids.",
  },
  selected_no_award: {
    term: "Selected, no award recorded",
    plain:
      "Officials finished evaluating the bids and picked a company, but the portal never recorded the contract as awarded. Many of these were probably awarded offline.",
  },
  division: {
    term: "Division",
    plain: "A local office of the city corporation (usually covering a group of wards) that runs its own tenders.",
  },
  fiscal_year: {
    term: "Financial year",
    plain: "India's government year, running from 1 April to 31 March. '2024-25' means April 2024 to March 2025.",
  },
  concentration: {
    term: "Concentration",
    plain:
      "How much of the work goes to a few contractors. We express it as 'as if shared among N equal contractors': a small N means a few firms dominate.",
  },
  risk_indicator: {
    term: "Warning sign (risk indicator)",
    plain:
      "A pattern in the records that can be a sign of manipulation, but usually has an innocent explanation. It is a reason to look closer, never proof.",
  },
  reserved: {
    term: "Reserved tender",
    plain: "A tender open only to certain groups of contractors (for example under SC/ST reservation), so fewer bidders are expected.",
  },
  gba: {
    term: "GBA and the city corporations",
    plain:
      "In 2025 the Bruhat Bengaluru Mahanagara Palike (BBMP) was replaced by the Greater Bengaluru Authority and five city corporations: Central, East, North, South and West.",
  },
};
