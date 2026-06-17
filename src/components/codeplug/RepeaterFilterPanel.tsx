import type { Settings } from "@/lib/codeplug/models";
import type { Summary } from "@/lib/codeplug/importers/sk6ba";
import { Field, MultiSelect, SectionLabel } from "./common";

export function RepeaterFilterPanel({ summary, settings, setSettings }: {
  summary: Summary; settings: Settings; setSettings: (s: Settings) => void;
}) {
  const allStatuses = Object.keys(summary.uniqueCounts.status);
  const allTypes = Object.keys(summary.uniqueCounts.type);
  const allBands = Object.keys(summary.uniqueCounts.band);
  const allDistricts = Object.keys(summary.uniqueCounts.district).filter((d) => /^\d+$/.test(d));
  const upd = (patch: Partial<Settings["filter"]>) => setSettings({ ...settings, filter: { ...settings.filter, ...patch } });

  return (
    <div>
      <SectionLabel>Filter</SectionLabel>
      <div className="grid gap-4 md:grid-cols-2">
        <MultiSelect label="Status" options={allStatuses} value={settings.filter.statuses} onChange={(v) => upd({ statuses: v })} />
        <MultiSelect label="Typ" options={allTypes} value={settings.filter.types} onChange={(v) => upd({ types: v })} />
        <MultiSelect label="Band" options={allBands} value={settings.filter.bands} onChange={(v) => upd({ bands: v })} />
        <MultiSelect label="Distrikt (tomt = alla svenska)" options={allDistricts} value={settings.filter.districts} onChange={(v) => upd({ districts: v })} />
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
          <input type="checkbox" checked={settings.filter.includeUnknownDistricts}
            onChange={(e) => upd({ includeUnknownDistricts: e.target.checked })} />
          Inkludera utländska/okända distrikt
        </label>
      </div>
    </div>
  );
}
