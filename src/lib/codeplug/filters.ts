import type { FilterSettings, NormalizedChannel } from "./models";

export function applyFilters(channels: NormalizedChannel[], f: FilterSettings): NormalizedChannel[] {
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

    const district = (c.district || "").trim();
    const swedishDistrict = /^\d+$/.test(district);
    if (!swedishDistrict && !f.includeUnknownDistricts) return false;
    if (f.districts.length && !f.districts.includes(district)) {
      if (swedishDistrict || !f.includeUnknownDistricts) return false;
    }

    return true;
  });
}
