import type { Settings, FilterSettings } from "@/lib/codeplug/models";
import type { Summary } from "@/lib/codeplug/importers/sk6ba";
import {
  COUNTRY_NAMES,
  COUNTRY_SORT_ORDER,
  NORDIC_COUNTRY_CODES,
  type RegionCountryCode,
} from "@/lib/codeplug/region";
import { Field, Hint, MultiSelect, SectionLabel } from "./common";

const ALL_COUNTRY_CODES: RegionCountryCode[] = (
  Object.keys(COUNTRY_SORT_ORDER) as RegionCountryCode[]
).sort((a, b) => COUNTRY_SORT_ORDER[a] - COUNTRY_SORT_ORDER[b]);

export function RepeaterFilterPanel({ summary, settings, setSettings }: {
  summary: Summary; settings: Settings; setSettings: (s: Settings) => void;
}) {
  const allStatuses = Object.keys(summary.uniqueCounts.status);
  const allTypes = Object.keys(summary.uniqueCounts.type);
  const allBands = Object.keys(summary.uniqueCounts.band);

  const upd = (patch: Partial<FilterSettings>) =>
    setSettings({ ...settings, filter: { ...settings.filter, ...patch } });

  // Countries / regions actually present in the imported file.
  const present = summary.countryCounts ?? {};
  const presentRegions = summary.regionCounts ?? {};
  const presentCountries = (Object.keys(present) as RegionCountryCode[])
    .filter((c) => c !== "unknown")
    .sort((a, b) => COUNTRY_SORT_ORDER[a] - COUNTRY_SORT_ORDER[b]);

  // Use what's actually in the file; fall back to the full list if Summary
  // is from an older import without the new counts.
  const countryOptions =
    presentCountries.length > 0
      ? presentCountries
      : ALL_COUNTRY_CODES.filter((c) => c !== "unknown");

  const regionOptions = Object.keys(presentRegions)
    .filter(Boolean)
    .sort();

  const selectedCountries = settings.filter.countries ?? [];
  const selectedRegions = settings.filter.regions ?? [];

  const setNordicQuick = () =>
    upd({ countries: [...NORDIC_COUNTRY_CODES], regions: [] });
  const clearCountries = () => upd({ countries: [], regions: [] });
  const setSwedenOnly = () =>
    upd({ countries: ["SE"], regions: [] });

  return (
    <div>
      <SectionLabel>Filter</SectionLabel>
      <div className="grid gap-4 md:grid-cols-2">
        <MultiSelect label="Status" options={allStatuses} value={settings.filter.statuses} onChange={(v) => upd({ statuses: v })} />
        <MultiSelect label="Typ" options={allTypes} value={settings.filter.types} onChange={(v) => upd({ types: v })} />
        <MultiSelect label="Band" options={allBands} value={settings.filter.bands} onChange={(v) => upd({ bands: v })} />
        <div>
          <MultiSelect
            label="Land (tomt = alla)"
            options={countryOptions.map((c) => `${c} – ${COUNTRY_NAMES[c]}`)}
            value={selectedCountries.map((c) => `${c} – ${COUNTRY_NAMES[c]}`)}
            onChange={(v) => {
              const codes = v
                .map((s) => s.split(" – ")[0] as RegionCountryCode)
                .filter((c) => c in COUNTRY_SORT_ORDER);
              upd({ countries: codes });
            }}
          />
          <div className="mt-2 flex gap-1">
            <button type="button" onClick={setSwedenOnly}
              className="rounded border border-border px-2 py-0.5 text-xs">Bara Sverige</button>
            <button type="button" onClick={setNordicQuick}
              className="rounded border border-border px-2 py-0.5 text-xs">Norden</button>
            <button type="button" onClick={clearCountries}
              className="rounded border border-border px-2 py-0.5 text-xs">Alla</button>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <MultiSelect
          label="Region/distrikt (tomt = alla inom valda länder)"
          options={regionOptions}
          value={selectedRegions}
          onChange={(v) => upd({ regions: v })}
        />
        <Hint>Visar regioner som finns i den importerade filen (SM0–SM7, LA, OZ, OH0–OH9, TF, JW, JX, OY, OX).</Hint>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mt-3">
        <Field label="Mode-strategi">
          <select value={settings.filter.modeStrategy}
            onChange={(e) => upd({ modeStrategy: e.target.value as Settings["filter"]["modeStrategy"] })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
            <option value="contains_fm">Mode innehåller FM</option>
            <option value="exact_fm">Exakt FM</option>
            <option value="all">Alla rader</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input type="checkbox" checked={settings.filter.includeUnknownRegions ?? false}
            onChange={(e) => upd({ includeUnknownRegions: e.target.checked })} />
          Inkludera okända regioner
        </label>
      </div>
    </div>
  );
}
