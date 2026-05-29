import { parseNumberLoose } from "./importers/sk6ba";

export interface FrequencyParse {
  duplex: "" | "+" | "-";
  offset: number;
  shift: number | null;
  unclear: boolean;
}

export function parseShift(raw: string | undefined | null): FrequencyParse {
  const s = (raw ?? "").toString().trim();
  if (!s || s.toLowerCase() === "simplex") {
    return { duplex: "", offset: 0, shift: 0, unclear: false };
  }
  const n = parseNumberLoose(s);
  if (n == null) return { duplex: "", offset: 0, shift: null, unclear: true };
  if (n === 0) return { duplex: "", offset: 0, shift: 0, unclear: false };
  if (n < 0) return { duplex: "-", offset: Math.abs(n), shift: n, unclear: false };
  return { duplex: "+", offset: n, shift: n, unclear: false };
}

export function formatFrequency(n: number): string {
  return n.toFixed(6);
}
