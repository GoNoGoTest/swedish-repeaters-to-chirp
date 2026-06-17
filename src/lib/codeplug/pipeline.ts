import type { NormalizedChannel, RawRow, Settings, Warning, NamingSettings } from "./models";
import { parseNumberLoose } from "./importers/sk6ba";
import { parseAccess } from "./tones";
import { parseShift } from "./frequency";
import { applyFilters } from "./filters";
import { buildName, resolveCollisions } from "./naming";
import { sortChannels } from "./sorting";
import { applyFreqDedupe } from "./dedupe";
import { DEFAULT_PACK_NAMING } from "./defaults";
import { deriveRegion } from "./region";

function emptyPackFields() {
  return {
    pack_id: "",
    service: "",
    category: "",
    tags: [] as string[],
    label: "",
    name_hint: "",
    tx_frequency: null as number | null,
    mode_chirp: "",
    tstep: null as number | null,
    tone_raw: "",
    rtone_freq: null as number | null,
    ctone_freq: null as number | null,
    dtcs_code: "",
    dtcs_polarity: "",
    skip_raw: "",
    tx_allowed: true,
    rx_only: false,
    license_note: "",
    source: "",
    source_url: "",
    inferred_from_range: false,
  };
}

export function normalize(rows: RawRow[]): NormalizedChannel[] {
  return rows.map((r, idx) => {
    const warnings: Warning[] = [];
    const output = parseNumberLoose(r.output);
    if (r.output && parseNumberLoose(r.output) == null) {
      warnings.push({ code: "invalid_output", message: `Ogiltig output: ${r.output}` });
    }
    if (output == null) warnings.push({ code: "missing_output", message: "Saknad outputfrekvens" });

    const shift = parseShift(r.tx_shift);
    if (shift.unclear) warnings.push({ code: "unclear_shift", message: `Oklar tx_shift: ${r.tx_shift}` });

    const access = parseAccess(r.access);
    if (!access.ctcss && !access.uses1750 && !access.carrier && !access.dcs && r.access) {
      warnings.push({ code: "missing_access_tone", message: `Otydlig access: ${r.access}` });
    }
    if (access.ctcss != null && access.dcs) {
      warnings.push({ code: "ctcss_and_dcs", message: `Både CTCSS och DCS hittades; CTCSS valdes för analog CHIRP-export.` });
    }

    const lat = parseNumberLoose(r.lat);
    const lng = parseNumberLoose(r.lng);
    if (lat == null || lng == null) {
      warnings.push({ code: "missing_coords", message: "Saknade koordinater" });
    }

    const modeRaw = (r.mode ?? "").toString();
    const district = (r.district ?? "").toString().trim();
    const type = (r.type ?? "").toString().trim();
    const network = (r.network ?? "").toString().trim();
    const city = (r.city ?? "").toString().trim();
    const call = (r.call ?? "").toString().trim();
    const channel = (r.channel ?? "").toString().trim();
    const band = (r.band ?? "").toString().trim();
    const locator = (r.locator ?? "").toString().trim();

    const commentParts = [
      call, channel, city,
      district ? `D${district}` : "",
      type, network,
      r.access ? `access=${r.access}` : "",
      locator ? `loc=${locator}` : "",
    ].filter(Boolean);

    return {
      source_type: "sk6ba",
      source_row: idx + 2,
      source_id: (r.id ?? "").toString(),
      type, status: (r.status ?? "").toString().trim(),
      mode_raw: modeRaw,
      is_analog_fm: /\bFM\b/i.test(modeRaw),
      band, district, region: deriveRegion(district, call),
      city, call, channel, network,
      network_id: (r.network_id ?? "").toString(),
      access_raw: (r.access ?? "").toString(),
      rx_frequency: output,
      tx_shift_raw: (r.tx_shift ?? "").toString(),
      tx_shift: shift.shift,
      shift_unclear: shift.unclear,
      duplex: shift.duplex,
      offset: shift.offset,
      ctcss_tx: access.ctcss,
      uses_1750: access.uses1750,
      lat, lng, locator,
      comment: commentParts.join(" | "),
      ...emptyPackFields(),
      // Re-apply DCS over the empty pack defaults so SK6BA rows with
      // access=DCS xxx export as Tone=Cross in the CHIRP exporter.
      dtcs_code: access.dcs ?? "",
      dtcs_polarity: access.dcs ? "NN" : "",
      generated_name_full: "",
      generated_name_final: "",
      collided: false,
      warnings,
    } satisfies NormalizedChannel;
  });
}

export interface PipelineInput {
  sk6baRows: RawRow[];
  packChannels?: NormalizedChannel[]; // already-selected channel pack rows
  settings: Settings;
  /**
   * Effective max channel-name length. Comes from the active export target
   * (e.g. ChirpSettings.maxLength for chirp-generic). Defaults to 6 so
   * legacy callers and tests work without wiring a target.
   */
  maxNameLength?: number;
}

export interface PipelineResult {
  channels: NormalizedChannel[];
  filteredOut: number;
  unresolvedCollisions: number;
  totalInput: number;
  packCount: number;
  sk6baCount: number;
  duplicateStop: boolean;
}

function applyRxOnlyPolicy(channels: NormalizedChannel[], settings: Settings): NormalizedChannel[] {
  const out: NormalizedChannel[] = [];
  for (const ch of channels) {
    const isRxOnly = ch.source_type === "channel_pack" && (ch.rx_only || !ch.tx_allowed);
    if (!isRxOnly) { out.push(ch); continue; }
    switch (settings.packs.rxOnlyPolicy) {
      case "skip":
        continue;
      case "stop":
        ch.warnings.push({ code: "rx_only_no_policy", message: "RX-only stoppar export (policy=stop)" });
        out.push(ch);
        break;
      case "duplex_off":
        ch.duplex = "off";
        out.push(ch);
        break;
      case "mark":
      default:
        ch.comment = ch.comment ? `RX-ONLY | ${ch.comment}` : "RX-ONLY";
        ch.warnings.push({ code: "rx_only_marked", message: "RX-only: markerad i Comment, exporteras som vanlig frekvens" });
        out.push(ch);
        break;
    }
  }
  return out;
}

export function runPipeline(input: PipelineInput): PipelineResult {
  const { sk6baRows, packChannels = [], settings, maxNameLength = 6 } = input;
  const totalInput = sk6baRows.length + packChannels.length;
  const normalized = normalize(sk6baRows);
  const exportable = normalized.filter((c) => c.rx_frequency != null);
  const sk6baFiltered = applyFilters(exportable, settings.filter);
  const sk6baSorted = sortChannels(sk6baFiltered, settings.sort);

  // Channel-pack rows come from a module-level cache and are reused across
  // renders. Clone them and reset per-run state so warnings/duplex/comment
  // mutations below don't accumulate on every re-render.
  const validPacks = packChannels
    .filter((c) => c.rx_frequency != null)
    .map((c) => ({
      ...c,
      warnings: [],
      collided: false,
      generated_name_full: "",
      generated_name_final: "",
    }));
  const packWithPolicy = applyRxOnlyPolicy(validPacks, settings);
  // Validate split: needs tx_frequency or it can't export properly
  for (const ch of packWithPolicy) {
    if (ch.duplex === "split" && ch.tx_frequency == null) {
      ch.warnings.push({ code: "pack_split_unsupported", message: "Split-kanal saknar tx_frequency" });
    }
  }

  // Combine according to placement
  let combined: NormalizedChannel[];
  if (settings.packs.placement === "off" || packWithPolicy.length === 0) {
    combined = sk6baSorted;
  } else if (settings.packs.placement === "prepend") {
    combined = [...packWithPolicy, ...sk6baSorted];
  } else {
    combined = [...sk6baSorted, ...packWithPolicy];
  }

  // Freq dedupe across the whole set
  const dedupe = applyFreqDedupe(combined, settings.packs.freqDupePolicy);
  combined = dedupe.channels;

  // Resolve naming per channel using the correct rules
  // (sk6ba = settings.naming, channel_pack = per-pack override or DEFAULT_PACK_NAMING)
  const namingFor = (ch: NormalizedChannel): NamingSettings => {
    if (ch.source_type === "sk6ba") return settings.naming;
    const override = settings.packs.selection[ch.pack_id]?.naming;
    return override ?? DEFAULT_PACK_NAMING;
  };

  for (const ch of combined) {
    const n = namingFor(ch);
    const { full, clipped } = buildName(ch, n, maxNameLength);
    ch.generated_name_full = full;
    ch.generated_name_final = clipped || "NONAME";
    if (!clipped) ch.warnings.push({ code: "empty_name", message: "Tomt kanalnamn" });
  }

  // Collisions are resolved globally with the repeater naming policy
  // (we just need a deterministic suffix scheme — maxLength comes from the active export target).
  const { unresolved } = resolveCollisions(combined, settings.naming, maxNameLength);
  for (const ch of combined) {
    if (ch.collided) {
      const already = ch.warnings.some((w) => w.code === "name_collision");
      if (!already) ch.warnings.push({ code: "name_collision", message: "Namnkollision" });
    }
  }

  return {
    channels: combined,
    filteredOut: totalInput - combined.length,
    unresolvedCollisions: unresolved,
    totalInput,
    packCount: combined.filter((c) => c.source_type === "channel_pack").length,
    sk6baCount: combined.filter((c) => c.source_type === "sk6ba").length,
    duplicateStop: dedupe.stopped,
  };
}
