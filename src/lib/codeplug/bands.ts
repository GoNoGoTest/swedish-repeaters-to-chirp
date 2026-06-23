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
