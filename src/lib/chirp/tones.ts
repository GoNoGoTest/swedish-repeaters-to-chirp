import { parseNumberLoose } from "./importers/sk6ba";

export interface ToneParse {
  ctcss: number | null;
  uses1750: boolean;
}

export function parseAccess(raw: string | undefined | null): ToneParse {
  if (!raw) return { ctcss: null, uses1750: false };
  const s = String(raw);
  const parts = s.split(/[\s/|,;]+/).map((p) => p.trim()).filter(Boolean);
  let uses1750 = false;
  const candidates: number[] = [];
  for (const p of parts) {
    const n = parseNumberLoose(p);
    if (n == null) continue;
    if (n === 1750) {
      uses1750 = true;
      continue;
    }
    if (n >= 40 && n <= 300) candidates.push(n);
  }
  // Choose last CTCSS candidate (documented rule)
  const ctcss = candidates.length ? candidates[candidates.length - 1] : null;
  return { ctcss, uses1750 };
}
