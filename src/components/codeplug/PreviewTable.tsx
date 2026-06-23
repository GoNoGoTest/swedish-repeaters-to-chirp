import type { NormalizedChannel } from "@/lib/codeplug/models";
import { Switch } from "@/components/ui/switch";

// eslint-disable-next-line react-refresh/only-export-components
export function channelKey(c: NormalizedChannel): string {
  return [
    c.source_type,
    c.pack_id ?? "",
    c.source_id,
    c.source_row,
    c.mode_effective,
    c.rx_frequency?.toFixed(6) ?? "",
  ].join(":");
}

export function PreviewTable({
  channels,
  excludedKeys,
  onToggleExclude,
  getExportMode,
  startLoc,
  exportCount,
}: {
  channels: NormalizedChannel[];
  excludedKeys: Set<string>;
  onToggleExclude: (key: string) => void;
  /** Returnera target-specifikt export-mode token för raden. */
  getExportMode: (c: NormalizedChannel) => string;
  startLoc: number;
  exportCount?: number;
}) {
  let locCounter = startLoc;
  return (
    <div className="overflow-auto rounded border border-border max-h-[70vh]">
      <table className="min-w-full text-xs font-mono">
        <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
          <tr>
            {[
              "Exkl.",
              "#",
              "Loc",
              "Källa",
              "Namn (full → final)",
              "Freq",
              "Dpx",
              "Off",
              "Tone",
              "Signal",
              "Export",
              "Type/Net/Kat",
              "Plats / Label",
              "Tags",
              "Comment",
              "⚠",
            ].map((h) => (
              <th key={h} className="px-2 py-1 text-left whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {channels.map((c, i) => {
            const isPack = c.source_type === "channel_pack";
            const key = channelKey(c);
            const excluded = excludedKeys.has(key);
            const realWarnings = c.warnings.filter((w) => w.code !== "name_collision");
            const baseRowClass = realWarnings.length
              ? "bg-destructive/5"
              : isPack
                ? "bg-primary/5"
                : "";
            const rowClass = excluded
              ? "opacity-40 line-through decoration-muted-foreground/50"
              : baseRowClass;
            const mode = isPack && c.mode_pack ? c.mode_pack : chirpMode;
            const loc = excluded ? "—" : String(locCounter++);
            return (
              <tr
                key={`${c.source_type}-${c.source_row}-${c.source_id}-${i}`}
                className={`border-t border-border ${rowClass}`}
              >
                <td className="px-2 py-1 no-underline">
                  <Switch
                    checked={excluded}
                    onCheckedChange={() => onToggleExclude(key)}
                    aria-label={`Exkludera rad ${c.source_row} från export`}
                  />
                </td>
                <td className="px-2 py-1 text-muted-foreground">{c.source_row}</td>
                <td className="px-2 py-1">{loc}</td>
                <td className="px-2 py-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${isPack ? "bg-primary/20 text-primary" : "bg-muted text-foreground"}`}
                  >
                    {isPack ? `PACK · ${c.pack_id}` : "SK6BA"}
                  </span>
                </td>
                <td className="px-2 py-1">
                  <div className="text-muted-foreground">{c.generated_name_full}</div>
                  <div className={c.collided ? "text-amber-500" : ""}>{c.generated_name_final}</div>
                </td>
                <td className="px-2 py-1">{c.rx_frequency?.toFixed(4)}</td>
                <td className="px-2 py-1">{c.duplex || "—"}</td>
                <td className="px-2 py-1">
                  {c.duplex === "split" && c.tx_frequency != null
                    ? c.tx_frequency.toFixed(4)
                    : c.offset.toFixed(3)}
                </td>
                <td className="px-2 py-1">{c.ctcss_tx ?? (c.uses_1750 ? "1750" : "—")}</td>
                <td className="px-2 py-1">{mode}</td>
                <td className="px-2 py-1 truncate max-w-[10rem]">
                  {isPack
                    ? `${c.service || "?"} / ${c.category || "?"}`
                    : `${c.type}${c.network ? `/${c.network}` : ""}`}
                </td>
                <td className="px-2 py-1 truncate max-w-[10rem]">
                  {isPack
                    ? `${c.label || ""} ${c.channel ? `(${c.channel})` : ""}`.trim() || c.name_hint
                    : c.city}
                  {c.rx_only && (
                    <span className="ml-1 rounded bg-destructive/20 px-1 text-[9px] text-destructive">
                      RX
                    </span>
                  )}
                  {c.inferred_from_range && (
                    <span className="ml-1 rounded bg-amber-500/20 px-1 text-[9px] text-amber-700 dark:text-amber-300">
                      INF
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 truncate max-w-[10rem] text-muted-foreground">
                  {c.tags.join(", ")}
                </td>
                <td
                  className="px-2 py-1 truncate max-w-[14rem] text-muted-foreground"
                  title={c.license_note || c.comment}
                >
                  {c.comment}
                </td>
                <td className="px-2 py-1">
                  {realWarnings.length ? (
                    <span
                      title={realWarnings.map((w) => w.message).join("; ")}
                      className="text-amber-500"
                    >
                      !{realWarnings.length}
                    </span>
                  ) : (
                    ""
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border sticky bottom-0 bg-card">
        {channels.length} rader visas ·{" "}
        {exportCount ?? channels.filter((c) => !excludedKeys.has(channelKey(c))).length} exporteras
      </div>
    </div>
  );
}
