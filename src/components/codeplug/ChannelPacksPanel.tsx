import { useMemo, useState } from "react";
import type { PackSelectionEntry, Settings } from "@/lib/codeplug/models";
import type { MergedPack } from "@/lib/codeplug/channel_packs/registry";
import { DEFAULT_PACK_NAMING } from "@/lib/codeplug/defaults";
import { MultiSelect, SectionLabel } from "./common";
import { NamingEditor } from "./NamingEditor";
import { ParseWarningsPanel } from "./ParseWarningsPanel";

const PACK_TOKENS = ["{service}", "{category}", "{label}", "{name_hint}", "{channel}", "{band}"];

function defaultPackEntry(): PackSelectionEntry {
  return { enabled: false, bands: [], categories: [], tags: [], useEnabledDefault: true };
}

function PackRow({
  pack,
  entry,
  maxLength,
  onChange,
}: {
  pack: MergedPack;
  entry: PackSelectionEntry | undefined;
  maxLength: number;
  onChange: (patch: Partial<PackSelectionEntry>) => void;
}) {
  const [open, setOpen] = useState(false);
  const sel: PackSelectionEntry = entry ?? defaultPackEntry();
  const enabled = sel.enabled;

  const bands = useMemo(
    () => Array.from(new Set(pack.channels.map((c) => c.band).filter(Boolean))).sort(),
    [pack],
  );
  const categories = useMemo(
    () => Array.from(new Set(pack.channels.map((c) => c.category).filter(Boolean))).sort(),
    [pack],
  );
  const tags = useMemo(
    () => Array.from(new Set(pack.channels.flatMap((c) => c.tags))).sort(),
    [pack],
  );
  const services = Array.from(new Set(pack.channels.map((c) => c.service).filter(Boolean))).join(
    ", ",
  );
  const enabledDefaultCount = pack.channels.filter((c) => c.enabled_default).length;
  const allRxOnly = pack.channels.every((c) => c.rx_only);

  const naming = sel.naming ?? DEFAULT_PACK_NAMING;

  return (
    <div
      className={`rounded border ${enabled ? "border-primary/50" : "border-border"} bg-background`}
    >
      <div className="flex items-center gap-3 p-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="h-4 w-4"
        />
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{pack.packId}</span>
            {allRxOnly && (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                RX-only
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {pack.channels.length} rader · {services || "—"} · {pack.fileNames.join(", ")}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-muted-foreground"
        >
          {open ? "Dölj ▲" : "Inställningar ▼"}
        </button>
      </div>

      {open && (
        <div className="border-t border-border p-3 space-y-4">
          <div>
            <SectionLabel>Vilka kanaler från paketet</SectionLabel>
            <div className="grid gap-3 md:grid-cols-3">
              {bands.length > 0 && (
                <MultiSelect
                  label="Band"
                  options={bands}
                  value={sel.bands}
                  onChange={(v) => onChange({ bands: v })}
                />
              )}
              {categories.length > 0 && (
                <MultiSelect
                  label="Kategori"
                  options={categories}
                  value={sel.categories}
                  onChange={(v) => onChange({ categories: v })}
                />
              )}
              {tags.length > 0 && (
                <MultiSelect
                  label="Tag"
                  options={tags}
                  value={sel.tags}
                  onChange={(v) => onChange({ tags: v })}
                />
              )}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sel.useEnabledDefault}
                onChange={(e) => onChange({ useEnabledDefault: e.target.checked })}
              />
              Bara rader paketet markerat som <code>enabled_default=true</code> (
              {enabledDefaultCount} rader). Tomt band/kategori/tag = alla.
            </label>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Namngivning för detta paket</SectionLabel>
              {sel.naming && (
                <button
                  type="button"
                  onClick={() => onChange({ naming: undefined })}
                  className="text-xs text-muted-foreground underline"
                >
                  Återställ till standard
                </button>
              )}
            </div>
            <NamingEditor
              value={naming}
              onChange={(n) => onChange({ naming: n })}
              tokens={PACK_TOKENS}
              hint={`Standard: \`{name_hint}\`, max ${maxLength} tecken — funkar för t.ex. "S20", "PMR1", "M16". Skriv egen mall om paketet kräver annat.`}
              previewKind="pack"
              maxLength={maxLength}
              showCityMaxLength={false}
              sampleChannels={pack.channels}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ChannelPacksPanel({
  packs,
  settings,
  setSettings,
  selectedPackCount,
  selectedChannelCount,
  maxNameLength,
}: {
  packs: MergedPack[];
  settings: Settings;
  setSettings: (s: Settings) => void;
  selectedPackCount: number;
  selectedChannelCount: number;
  maxNameLength: number;
}) {
  const updPack = (packId: string, patch: Partial<PackSelectionEntry>) => {
    const cur = settings.packs.selection[packId] ?? defaultPackEntry();
    setSettings({
      ...settings,
      packs: {
        ...settings.packs,
        selection: { ...settings.packs.selection, [packId]: { ...cur, ...patch } },
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {packs.length} paket tillgängliga · {selectedPackCount} valda · {selectedChannelCount}{" "}
        kanaler kommer läggas till. Klicka på ett paket för att fälla ut bands-/kategorifilter och
        egen namngivning.
      </div>
      {packs
        .filter((p) => p.parseWarnings.length > 0)
        .map((p) => (
          <ParseWarningsPanel
            key={p.packId}
            title={`i kanalpaket ${p.packId}`}
            warnings={p.parseWarnings}
          />
        ))}
      {packs.map((pack) => (
        <PackRow
          key={pack.packId}
          pack={pack}
          entry={settings.packs.selection[pack.packId]}
          maxLength={maxNameLength}
          onChange={(patch) => updPack(pack.packId, patch)}
        />
      ))}
    </div>
  );
}
