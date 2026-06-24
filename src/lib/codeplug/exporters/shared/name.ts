/**
 * Shared name-truncation helper used by export targets that cap channel
 * names to a hardware-specific width.
 *
 * Counts visual code points via `Array.from()` so multi-byte / emoji
 * characters consume one slot, matching what the user sees in radio
 * display widths (which are character-cell based, not UTF-16 unit based).
 */
export function truncateName(raw: string, maxLen: number): { name: string; truncated: boolean } {
  const chars = Array.from(raw);
  if (chars.length <= maxLen) return { name: raw, truncated: false };
  return { name: chars.slice(0, maxLen).join(""), truncated: true };
}
