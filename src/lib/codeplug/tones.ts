import { parseNumberLoose } from "./importers/sk6ba";

export interface ToneParse {
  ctcss: number | null;
  uses1750: boolean;
  carrier: boolean;
  dcs: string | null;
}

// Notera `no[_\s]*tone` — efter preprocess nedan blir `"no tone"` → `"no_tone"`,
// så detta mönster måste acceptera både formen efter normalisering (no_tone)
// och den teoretiska ihopskrivna formen (notone).
const CARRIER_RE = /^(carrier|open|none|ingen|no[_\s]*tone)$/i;
const DCS_PREFIX_RE = /^(?:DCS|DTCS)$/i;
const DCS_INLINE_RE = /^(?:DCS|DTCS)0*(\d{1,3})$/i;
const DCS_DSHORT_RE = /^D0*(\d{1,3})$/i;

function normalizeDcs(raw: string | number): string | null {
  const n = typeof raw === "number" ? raw : parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 999) return null;
  return String(n).padStart(3, "0");
}

/**
 * Preprocess: tokeniseringen nedan delar på whitespace, så "no tone" blev
 * tidigare två tokens (["no","tone"]) och CARRIER_RE matchade aldrig.
 * Vi kollapsar varianten innan splittringen så att carrier-detektionen
 * fungerar som redan avsett av regexen. Returshape oförändrad.
 */
function preprocessRaw(s: string): string {
  return s.replace(/\bno\s+tone\b/gi, "no_tone");
}

export function parseAccess(raw: string | undefined | null): ToneParse {
  if (!raw) return { ctcss: null, uses1750: false, carrier: false, dcs: null };
  const s = preprocessRaw(String(raw));
  const parts = s
    .split(/[\s/|;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const consumed = new Set<number>();
  let uses1750 = false;
  let carrier = false;
  let dcs: string | null = null;

  // First pass: DCS detection (consumes tokens to avoid CTCSS misread).
  for (let i = 0; i < parts.length; i++) {
    if (consumed.has(i)) continue;
    const p = parts[i];
    if (DCS_PREFIX_RE.test(p)) {
      const next = parts[i + 1];
      if (next && /^\d{1,3}$/.test(next)) {
        const norm = normalizeDcs(next);
        if (norm) {
          dcs = norm;
          consumed.add(i);
          consumed.add(i + 1);
        }
      }
      continue;
    }
    const inline = p.match(DCS_INLINE_RE);
    if (inline) {
      const norm = normalizeDcs(inline[1]);
      if (norm) {
        dcs = norm;
        consumed.add(i);
      }
      continue;
    }
    const dshort = p.match(DCS_DSHORT_RE);
    // Only accept "D###" form (4 chars, e.g. D025) — avoids matching loose "D7".
    if (dshort && p.length === 4) {
      const norm = normalizeDcs(dshort[1]);
      if (norm) {
        dcs = norm;
        consumed.add(i);
      }
    }
  }

  // Second pass: existing CTCSS / 1750 / carrier logic on remaining tokens.
  const candidates: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (consumed.has(i)) continue;
    const p = parts[i];
    if (CARRIER_RE.test(p)) {
      carrier = true;
      continue;
    }
    const n = parseNumberLoose(p);
    if (n == null) continue;
    if (n === 1750) {
      uses1750 = true;
      continue;
    }
    if (n >= 40 && n <= 300) candidates.push(n);
  }
  const ctcss = candidates.length ? candidates[candidates.length - 1] : null;
  return { ctcss, uses1750, carrier, dcs };
}

// ---------------------------------------------------------------------------
// Digital access (DMR / C4FM / P25)
// ---------------------------------------------------------------------------

export interface DigitalAccess {
  dmr: { colorCode: number | null; timeSlot: number | null; talkGroup: string };
  c4fm: { dgIdTx: number | null; dgIdRx: number | null };
  p25: { nac: string };
  /**
   * Fragment som varken `parseAccess` (analog) eller någon digital
   * regex konsumerade. Diagnostik — inte en varning i sig.
   */
  unknownTokens: string[];
}

const EMPTY_DIGITAL: DigitalAccess = {
  dmr: { colorCode: null, timeSlot: null, talkGroup: "" },
  c4fm: { dgIdTx: null, dgIdRx: null },
  p25: { nac: "" },
  unknownTokens: [],
};

// Token-mönster. Alla case-insensitive. Stöder ihopskrivet (CC1), separerat
// (CC 1) och =-form (CC=1).
const DMR_CC_RE = /\bCC\s*=?\s*(\d{1,2})\b/gi;
// TS-regexen accepterar avsiktligt alla siffror för att kunna flagga
// ogiltiga värden (t.ex. TS3) diagnostiskt i unknownTokens.
const DMR_TS_RE = /\bTS\s*=?\s*(\d+)\b/gi;
const DMR_TG_RE = /\bTG\s*=?\s*([\w-]+)\b/gi;
const C4FM_TX_RE = /\bTX\s*=?\s*(\d{2})\b/gi;
const C4FM_RX_RE = /\bRX\s*=?\s*(\d{2})\b/gi;
const P25_NAC_RE = /\bNAC\s*=?\s*([0-9A-F]{3})\b/gi;

// Mönster som motsvarar tokens `parseAccess` skulle konsumerat — dessa ska
// INTE hamna i unknownTokens även om parseDigitalAccess körs separat.
const ANALOG_NUMBER_RE = /^\d+(?:[.,]\d+)?$/;
const ANALOG_CARRIER_RE = /^(carrier|open|none|ingen|no[_\s]*tone)$/i;
const ANALOG_DCS_TOKEN_RE = /^(?:DCS|DTCS)\d{0,3}$|^D\d{3}$/i;

export function parseDigitalAccess(raw: string | undefined | null): DigitalAccess {
  if (!raw)
    return {
      dmr: { ...EMPTY_DIGITAL.dmr },
      c4fm: { ...EMPTY_DIGITAL.c4fm },
      p25: { ...EMPTY_DIGITAL.p25 },
      unknownTokens: [],
    };
  let s = preprocessRaw(String(raw));
  const result: DigitalAccess = {
    dmr: { colorCode: null, timeSlot: null, talkGroup: "" },
    c4fm: { dgIdTx: null, dgIdRx: null },
    p25: { nac: "" },
    unknownTokens: [],
  };

  // För varje match: skriv över träffen i `s` med blanksteg så att efter-
  // tokeniseringen inte ser fragmentet (annars hamnar "CC1" i unknownTokens).
  const consumeAll = (re: RegExp, handler: (groups: string[]) => void): void => {
    s = s.replace(re, (full, ...rest) => {
      // rest = [g1, g2, ..., offset, fullString, (groups?)]
      const groups: string[] = [];
      for (const r of rest) {
        if (typeof r === "string") groups.push(r);
        else break;
      }
      handler(groups);
      return " ".repeat(full.length);
    });
  };

  consumeAll(DMR_CC_RE, ([n]) => {
    const v = parseInt(n, 10);
    if (Number.isFinite(v) && v >= 0 && v <= 15) result.dmr.colorCode = v;
  });
  consumeAll(DMR_TS_RE, ([n]) => {
    const v = parseInt(n, 10);
    if (v === 1 || v === 2) result.dmr.timeSlot = v;
  });
  consumeAll(DMR_TG_RE, ([id]) => {
    if (id) result.dmr.talkGroup = id;
  });
  consumeAll(C4FM_TX_RE, ([nn]) => {
    const v = parseInt(nn, 10);
    if (Number.isFinite(v)) result.c4fm.dgIdTx = v;
  });
  consumeAll(C4FM_RX_RE, ([nn]) => {
    const v = parseInt(nn, 10);
    if (Number.isFinite(v)) result.c4fm.dgIdRx = v;
  });
  consumeAll(P25_NAC_RE, ([nac]) => {
    if (nac) result.p25.nac = nac.toUpperCase();
  });

  // Återstoden: tokenisera och filtrera bort sådant parseAccess hade konsumerat.
  const tokens = s
    .split(/[\s/|;,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  for (const t of tokens) {
    if (ANALOG_NUMBER_RE.test(t)) continue;
    if (ANALOG_CARRIER_RE.test(t)) continue;
    if (ANALOG_DCS_TOKEN_RE.test(t)) continue;
    result.unknownTokens.push(t);
  }
  return result;
}
