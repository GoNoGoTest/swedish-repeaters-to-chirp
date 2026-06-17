import type { FilterSettings, NormalizedChannel } from "./models";

/**
 * Filter normalised channels using country/region-aware rules.
 *
 * - `countries` (empty = all) gates on `c.region.countryCode`.
 * - `regions` (empty = all within the gated countries) gates on
 *   `c.region.districtLabel` ("SM6", "LA", "OH0", …).
 * - `includeUnknownRegions` controls whether unknown-region rows pass.
 *
 * Legacy `includeUnknownDistricts` is honoured as an alias for
 * `includeUnknownRegions` when the new field is undefined, so old
 * persisted settings keep working without a forced reset.
 */
export function applyFilters(channels: NormalizedChannel[], f: FilterSettings): NormalizedChannel[] {
  const includeUnknown =
    f.includeUnknownRegions ?? f.includeUnknownDistricts ?? false;
  const countries = f.countries ?? [];
  const regions = f.regions ?? [];

  return channels.filter((c) => {
    if (f.statuses.length && !f.statuses.includes(c.status)) return false;
    if (f.types.length && !f.types.includes(c.type)) return false;

    if (f.modeStrategy === "exact_fm") {
      if (c.mode_raw.trim().toUpperCase() !== "FM") return false;
    } else if (f.modeStrategy === "contains_fm") {
      if (!/\bFM\b/i.test(c.mode_raw)) return false;
    } else if (f.modeStrategy === "custom") {
      if (!f.customModes.includes(c.mode_raw)) return false;
    }

    if (f.bands.length && !f.bands.includes(c.band)) return false;

    const isUnknown = c.region.countryCode === "unknown";
    if (isUnknown && !includeUnknown) return false;
    if (countries.length && !countries.includes(c.region.countryCode)) return false;
    if (regions.length && !regions.includes(c.region.districtLabel)) return false;

    return true;
  });
}
