import { useCallback, useEffect, useState } from "react";
import type { Settings } from "@/lib/codeplug/models";
import { DEFAULT_SETTINGS } from "@/lib/codeplug/defaults";

const STORAGE_KEY = "sk6ba-chirp-settings-v6";

function loadStoredSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      naming: { ...DEFAULT_SETTINGS.naming, ...(parsed.naming ?? {}) },
      packs: { ...DEFAULT_SETTINGS.packs, ...(parsed.packs ?? {}) },
      sort: { ...DEFAULT_SETTINGS.sort, ...(parsed.sort ?? {}) },
      export: {
        targetId: parsed?.export?.targetId ?? DEFAULT_SETTINGS.export.targetId,
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
