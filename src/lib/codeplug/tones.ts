import { parseNumberLoose } from "./importers/sk6ba";

export interface ToneParse {
  ctcss: number | null;
  uses1750: boolean;
  carrier: boolean;
  dcs: string | null;
}

const CARRIER_RE = /^(carrier|open|none|ingen|no\s*tone)$/i;
const DCS_PREFIX_RE = /^(?:DCS|DTCS)$/i;
const DCS_INLINE_RE = /^(?:DCS|DTCS)0*(\d{1,3})$/i;
const DCS_DSHORT_RE = /^D0*(\d{1,3})$/i;

function normalizeDcs(raw: string | number): string | null {
  const n = typeof raw === "number" ? raw : parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 999) return null;
  return String(n).padStart(3, "0");
}

export function parseAccess(raw: string | undefined | null): ToneParse {
  if (!raw) return { ctcss: null, uses1750: false, carrier: false, dcs: null };
  const s = String(raw);
  const parts = s.split(/[\s/|;]+/).map((p) => p.trim()).filter(Boolean);
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
    if (CARRIER_RE.test(p)) { carrier = true; continue; }
    const n = parseNumberLoose(p);
    if (n == null) continue;
    if (n === 1750) { uses1750 = true; continue; }
    if (n >= 40 && n <= 300) candidates.push(n);
  }
  const ctcss = candidates.length ? candidates[candidates.length - 1] : null;
  return { ctcss, uses1750, carrier, dcs };
}
