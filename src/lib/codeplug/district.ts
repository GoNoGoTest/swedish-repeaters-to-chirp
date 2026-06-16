/**
 * Extract Swedish amateur radio district digit from a callsign.
 * Returns "0".."7" or null for non-Swedish / unparsable callsigns.
 *
 * Swedish prefixes: SA, SB, SC, SE, SF, SG, SH, SI, SJ, SK, SL, SM, 7S, 8S.
 * The digit immediately after the prefix is the district number.
 *
 * Examples:
 *   SK6BA   -> "6"
 *   SM7XYZ  -> "7"
 *   7S2A    -> "2"
 *   DL1ABC  -> null
 */
export function extractDistrict(callsign: string): string | null {
  if (!callsign) return null;
  const c = callsign.trim().toUpperCase();
  // Standard Swedish prefixes
  const m1 = /^(?:S[A-MO-Z]|7S|8S)(\d)/.exec(c);
  if (m1) return m1[1];
  return null;
}
