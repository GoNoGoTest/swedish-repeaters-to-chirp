import { listTargets, requireTarget } from "@/lib/codeplug/targets";
import type { Settings } from "@/lib/codeplug/models";
import { Hint, LimitChip } from "./common";

export function TargetPickerPanel({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (s: Settings) => void;
}) {
  const targets = listTargets();
  const setTargetId = (id: string) => {
    const t = requireTarget(id);
    setSettings({
      ...settings,
      export: {
        ...settings.export,
        targetId: id,
        perTarget: {
          ...settings.export.perTarget,
          [id]: settings.export.perTarget[id] ?? { ...(t.defaultSettings as object) },
        },
      },
    });
  };
  const active = requireTarget(settings.export.targetId);
  const grouped = targets.reduce<Record<string, typeof targets>>((acc, t) => {
    (acc[t.vendor] ||= []).push(t);
    return acc;
  }, {});
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] items-start">
      <div>
        <select
          value={settings.export.targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm font-mono"
        >
          {Object.entries(grouped).map(([vendor, group]) => (
            <optgroup key={vendor} label={vendor}>
              {group.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Hint>
          Nya format läggs till i <code className="font-mono">src/lib/codeplug/targets/</code>.
        </Hint>
      </div>
      <div className="text-xs space-y-2">
        {active.description && (
          <p className="text-sm text-muted-foreground">{active.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <LimitChip label="Max kanaler" value={active.limits.maxChannels ?? "∞"} />
          {active.limits.maxChannelsPerGroup != null && (
            <LimitChip label="Kanaler/grupp" value={active.limits.maxChannelsPerGroup} />
          )}
          <LimitChip label="Namnlängd" value={active.limits.maxNameLength} />
          <LimitChip label="Moder" value={active.limits.supportedModes.join("/")} />
          {!active.exportMany && <LimitChip label="Split" value="ej stött" />}
        </div>
      </div>
    </div>
  );
}
