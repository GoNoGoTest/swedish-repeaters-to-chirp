import type { ChannelFrequency } from "../../models";

/**
 * Shared frequency-formatting helpers used by export targets. None of
 * these change the byte-output of existing exporters — they are exact
 * extractions of duplicated arithmetic.
 */

/** MHz → integer Hz, rounded to nearest Hz to avoid 6-decimal float drift. */
export function mhzToHz(mhz: number): number {
  return Math.round(mhz * 1_000_000);
}

/**
 * Format a frequency (MHz) with a fixed number of decimals. Returns `"0"`
 * padded to the requested precision when `mhz` is `null` — that matches
 * the current Nicsure RT-880 behaviour (empty cells render as "0.00000").
 * Pass `null` semantics intentionally so each target keeps its own
 * "render nothing" handling.
 */
export function formatMhzFixed(mhz: number, decimals: number): string {
  return mhz.toFixed(decimals);
}

/**
 * Derive the mobile-side TX frequency in MHz from `ChannelFrequency`.
 * Returns `null` when there is no RX frequency to anchor on.
 *
 * Resolution order:
 *  1. Explicit `tx_frequency` (channel-pack split rows).
 *  2. `rx_frequency + tx_shift` when `duplex` is `+`/`-` and a parsed
 *     shift exists.
 *  3. `rx_frequency ± offset` when `duplex` is `+`/`-`.
 *  4. Otherwise `rx_frequency` (simplex / "off" / unknown).
 *
 * Targets that need to override (e.g. RX-only mirroring) call this and
 * apply their own pre-check before/after.
 */
export function deriveTxMhz(c: ChannelFrequency): number | null {
  if (c.tx_frequency != null) return c.tx_frequency;
  if (c.rx_frequency == null) return null;
  if (c.duplex === "+" || c.duplex === "-") {
    const shift = c.tx_shift != null ? c.tx_shift : c.duplex === "+" ? c.offset : -c.offset;
    return c.rx_frequency + shift;
  }
  return c.rx_frequency;
}
