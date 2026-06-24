import { useMemo } from "react";
import type {
  ChirpSettings,
  NormalizedChannel,
  RxOnlyPolicy,
  Settings,
  Warning,
} from "@/lib/codeplug/models";
import { assertNever } from "@/lib/codeplug/assertNever";
import {
  type AnyExportTarget,
  requireTarget,
  resolveTargetSettings,
} from "@/lib/codeplug/targets";

/**
 * Bundle med target-relaterade deriveringar som tidigare låg utspridda i
 * `routes/index.tsx` som fyra närmast identiska `switch (target.id)`-block.
 *
 * Hookan gör narrowing exakt en gång — externa konsumenter får färdiga
 * värden och stabila closures utan att behöva känna till target-listan.
 *
 * Nya targets läggs till genom att utöka `switch`en nedan; `assertNever`
 * tvingar fram uppdateringen vid kompilering.
 */
export interface ActiveExportTargetBundle {
  /** Aktivt target (diskriminerad union — narrowa via `target.id` om du måste). */
  target: AnyExportTarget;
  /** Opaque user-patch från `settings.export.perTarget[id]`. */
  storedPatch: Record<string, unknown> | undefined;
  /** Effektiv max-namnlängd (target.resolveMaxNameLength ?? limits.maxNameLength). */
  maxNameLength: number;
  /** Stabil preview-mode-funktion: returnerar exportmodets visningstoken. */
  previewMode: (c: NormalizedChannel) => string;
  /** Stabil target-validator (returnerar tom array om target saknar validate). */
  validate: (channels: NormalizedChannel[]) => Warning[];
  /**
   * Loc-startposition för previewn. CHIRP läser `startLocation` ur sina
   * settings; övriga targets börjar alltid på 1. Generaliseras lätt: lägg
   * en `resolvePreviewStartLocation?(settings)` på `ExportTarget` om fler
   * targets behöver det.
   */
  previewStartLocation: number;
  /**
   * Targetspecifik RX-only-policy-kompatibilitet. RT-Systems Yaesu kan inte
   * uttrycka "blockera TX" på en RX-only kanal i sin Generic CSV; UI:t
   * faller tillbaka på "skip" när policyn väljs.
   */
  supportsRxOnlyPolicy: (p: RxOnlyPolicy) => boolean;
  /**
   * Bakåtkompatibel ChirpSettings-vy: när aktivt target är `chirp-generic`
   * returneras de resolvade settings; annars säkra defaults. Behövs av
   * `ExportPanel` som idag tar `chirpSettings` som prop oavsett target.
   */
  chirpSettings: ChirpSettings;
}

const CHIRP_FALLBACK: ChirpSettings = {
  startLocation: 1,
  mode: "NFM",
  tStep: 5.0,
  skipLinks: false,
  maxLength: 6,
};

interface InternalBundle<T> {
  target: AnyExportTarget;
  resolved: T;
  previewStartLocation: number;
}

function buildBundle<T>(
  inner: InternalBundle<T>,
  storedPatch: Record<string, unknown> | undefined,
  supportsRxOnlyPolicy: (p: RxOnlyPolicy) => boolean,
  chirpSettings: ChirpSettings,
): ActiveExportTargetBundle {
  const { target, resolved, previewStartLocation } = inner;
  // `target` är AnyExportTarget här, men `resolved` är typad som T för den
  // narrowade varianten. Vi kapslar in passningen via `previewMode`/`validate`
  // som båda är typade `(c, s: T) => ...` på den specifika `ExportTarget<T>`-
  // signaturen. Eftersom buildBundle bara anropas inom rätt case är detta
  // strukturellt korrekt — vi exponerar bara funktioner som redan har s bundet.
  const previewMode = (c: NormalizedChannel): string => {
    const fn = (target as { previewMode?: (c: NormalizedChannel, s: T) => string }).previewMode;
    return fn ? (fn(c, resolved) ?? "—") : "—";
  };
  const validate = (channels: NormalizedChannel[]): Warning[] => {
    const fn = (target as { validate?: (cs: NormalizedChannel[], s: T) => Warning[] }).validate;
    return fn ? fn(channels, resolved) : [];
  };
  const maxNameLength =
    (target as { resolveMaxNameLength?: (s: T) => number }).resolveMaxNameLength?.(resolved) ??
    target.limits.maxNameLength;
  return {
    target,
    storedPatch,
    maxNameLength,
    previewMode,
    validate,
    previewStartLocation,
    supportsRxOnlyPolicy,
    chirpSettings,
  };
}

const supportsRxOnlyPolicyAll = (_p: RxOnlyPolicy): boolean => true;
const supportsRxOnlyPolicyRtSystems = (p: RxOnlyPolicy): boolean => p !== "block_tx";

export function useActiveExportTarget(settings: Settings): ActiveExportTargetBundle {
  const target = useMemo(
    () => requireTarget(settings.export.targetId),
    [settings.export.targetId],
  );
  const storedPatch = settings.export.perTarget[settings.export.targetId] as
    | Record<string, unknown>
    | undefined;

  return useMemo<ActiveExportTargetBundle>(() => {
    switch (target.id) {
      case "chirp-generic": {
        const s = resolveTargetSettings(target, storedPatch);
        return buildBundle(
          { target, resolved: s, previewStartLocation: s.startLocation },
          storedPatch,
          supportsRxOnlyPolicyAll,
          s,
        );
      }
      case "vgc-n76": {
        const s = resolveTargetSettings(target, storedPatch);
        return buildBundle(
          { target, resolved: s, previewStartLocation: 1 },
          storedPatch,
          supportsRxOnlyPolicyAll,
          CHIRP_FALLBACK,
        );
      }
      case "nicsure-rt880": {
        const s = resolveTargetSettings(target, storedPatch);
        return buildBundle(
          { target, resolved: s, previewStartLocation: 1 },
          storedPatch,
          supportsRxOnlyPolicyAll,
          CHIRP_FALLBACK,
        );
      }
      case "rt-systems-yaesu-generic": {
        const s = resolveTargetSettings(target, storedPatch);
        return buildBundle(
          { target, resolved: s, previewStartLocation: 1 },
          storedPatch,
          supportsRxOnlyPolicyRtSystems,
          CHIRP_FALLBACK,
        );
      }
      default:
        return assertNever(target);
    }
  }, [target, storedPatch]);
}
