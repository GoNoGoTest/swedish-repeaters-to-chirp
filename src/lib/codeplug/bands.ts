/**
 * Display labels for amateur band codes used in SK6BA data.
 * Filter values still use the raw codes; this is presentation-only.
 */
export const BAND_LABELS: Record<string, string> = {
  "2": "2m",
  "4": "4m",
  "6": "6m",
  "10": "10m",
  "70": "70cm",
  "23": "23cm",
  "13": "13cm",
  "9": "9cm",
  "3": "3cm",
  "6cm": "6cm",
  "1.5": "1,25cm",
  "": "(tom)",
};

export function formatBandLabel(raw: string): string {
  return BAND_LABELS[raw] ?? raw;
}

export function parseBandLabel(label: string, known: string[]): string {
  // Reverse lookup against codes actually present in the data set.
  for (const raw of known) {
    if (formatBandLabel(raw) === label) return raw;
  }
  return label;
}

/**
 * Sort order by approximate centre frequency, lowest first.
 * Empty string (rendered as "(tom)") always sorts last.
 */
const BAND_FREQUENCY_ORDER: Record<string, number> = {
  "10": 28,
  "6": 50,
  "4": 70,
  "2": 144,
  "1.5": 222,
  "70": 430,
  "23": 1240,
  "13": 2300,
  "9": 3400,
  "6cm": 5650,
  "3": 10000,
};

export function sortBands(bands: string[]): string[] {
  return [...bands].sort((a, b) => {
    // Empty string last.
    if (a === "" && b === "") return 0;
    if (a === "") return 1;
    if (b === "") return -1;
    const fa = BAND_FREQUENCY_ORDER[a];
    const fb = BAND_FREQUENCY_ORDER[b];
    // Known bands sort by frequency.
    if (fa !== undefined && fb !== undefined) return fa - fb;
    // Known before unknown.
    if (fa !== undefined) return -1;
    if (fb !== undefined) return 1;
    // Unknown bands sort alphabetically among themselves.
    return a.localeCompare(b);
  });
}
