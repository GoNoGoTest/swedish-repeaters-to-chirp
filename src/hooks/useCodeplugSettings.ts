import { useCallback, useEffect, useState } from "react";
import type { Settings } from "@/lib/codeplug/models";
import { DEFAULT_SETTINGS } from "@/lib/codeplug/defaults";

const STORAGE_KEY = "sk6ba-chirp-settings-v6";

import { parseModes } from "@/lib/codeplug/modes";
import { getTarget } from "@/lib/codeplug/targets";

function migrateFilter(parsedFilter: any): Settings["filter"] {
  const base: any = { ...DEFAULT_SETTINGS.filter, ...(parsedFilter ?? {}) };
  // Legacy `includeUnknownDistricts` → `includeUnknownRegions` if new field missing.
  if (parsedFilter && parsedFilter.includeUnknownRegions === undefined
      && parsedFilter.includeUnknownDistricts !== undefined) {
    base.includeUnknownRegions = !!parsedFilter.includeUnknownDistricts;
  }
  // Legacy `modeStrategy` / `customModes` → `modes`.
  if (parsedFilter && (!Array.isArray(parsedFilter.modes))) {
    const strategy = parsedFilter.modeStrategy;
    if (strategy === "contains_fm" || strategy === "exact_fm") {
      base.modes = ["FM"];
    } else if (strategy === "all") {
      base.modes = [];
    } else if (strategy === "custom" && Array.isArray(parsedFilter.customModes)) {
      // Normalise custom values through parseModes so aliases map onto KNOWN_MODES.
      const out: string[] = [];
      for (const raw of parsedFilter.customModes) {
        for (const m of parseModes(String(raw))) {
          if (!out.includes(m)) out.push(m);
        }
      }
      base.modes = out;
    } else {
      base.modes = [...DEFAULT_SETTINGS.filter.modes];
    }
  }
  if (!Array.isArray(base.countries)) base.countries = DEFAULT_SETTINGS.filter.countries;
  if (!Array.isArray(base.regions)) base.regions = DEFAULT_SETTINGS.filter.regions;
  if (!Array.isArray(base.modes)) base.modes = [...DEFAULT_SETTINGS.filter.modes];
  return base;
}

function loadStoredSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      filter: migrateFilter(parsed.filter),
      naming: { ...DEFAULT_SETTINGS.naming, ...(parsed.naming ?? {}) },
      packs: { ...DEFAULT_SETTINGS.packs, ...(parsed.packs ?? {}) },
      sort: { ...DEFAULT_SETTINGS.sort, ...(parsed.sort ?? {}) },
      export: {
        targetId: (parsed?.export?.targetId && getTarget(parsed.export.targetId))
          ? parsed.export.targetId
          : DEFAULT_SETTINGS.export.targetId,
        perTarget: { ...DEFAULT_SETTINGS.export.perTarget, ...(parsed?.export?.perTarget ?? {}) },
        split: { ...DEFAULT_SETTINGS.export.split, ...(parsed?.export?.split ?? {}) },
      },
    };
  } catch { return DEFAULT_SETTINGS; }
}

export function useCodeplugSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadStoredSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings, hydrated]);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  return { settings, setSettings, hydrated, reset };
}
