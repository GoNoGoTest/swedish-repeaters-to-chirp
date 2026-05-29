import type { NamingSettings, NormalizedChannel } from "./models";

const TRANSLIT: Record<string, string> = {
  "Å": "A", "Ä": "A", "Ö": "O", "É": "E", "Ü": "U", "Ø": "O", "Æ": "AE",
  "å": "a", "ä": "a", "ö": "o", "é": "e", "ü": "u", "ø": "o", "æ": "ae",
};

export function translit(s: string): string {
  return s.replace(/[ÅÄÖÉÜØÆåäöéüøæ]/g, (c) => TRANSLIT[c] ?? c);
}

export function sanitize(s: string, opts: { transliterate: boolean; uppercase: boolean }): string {
  let out = s;
  if (opts.transliterate) out = translit(out);
  out = out.replace(/[^\w\-]/g, "");
  if (opts.uppercase) out = out.toUpperCase();
  return out;
}

function resolveToken(token: string, ch: NormalizedChannel, n: NamingSettings): string {
  switch (token) {
    case "{type}":
      return n.abbreviations.type[ch.type] ?? ch.type;
    case "{network}": {
      if (!ch.network) return n.abbreviations.network[""] ?? "";
      if (n.abbreviations.network[ch.network]) return n.abbreviations.network[ch.network];
      const first = ch.network.split(/[\s/]+/)[0];
      return n.abbreviations.network[first] ?? first;
    }
    case "{band}":
      return n.abbreviations.band[ch.band] ?? ch.band;
    case "{district}":
      return ch.district ? `${n.abbreviations.districtPrefix}${ch.district}` : "";
    case "{city}": {
      const primary = (ch.city || "").split("/")[0].trim();
      if (!primary) return "";
      const sanitized = sanitize(primary, { transliterate: n.transliterate, uppercase: n.uppercase });
      return n.cityMaxLength > 0 ? sanitized.slice(0, n.cityMaxLength) : sanitized;
    }
    case "{channel}":
      return ch.channel;
    case "{call}":
      return (ch.call || "").replace(/\//g, "");
    case "{service}":
      return ch.service;
    case "{category}":
      return ch.category;
    case "{label}":
      return ch.label;
    case "{name_hint}":
      return ch.name_hint;
    default:
      return "";
  }
}

/**
 * Build name by resolving tokens, sanitizing, dropping empty parts, then joining.
 * Smart join means a leading/trailing/double separator never appears just because
 * one token resolved to an empty string — useful for kanalpaket where city/call
 * are typically empty.
 *
 * Fallback for kanalpaket rader: om den valda mallen producerar en tom sträng
 * faller vi tillbaka på name_hint / channel / label så att raden får ett vettigt
 * default-namn utan att användaren behöver mecka med tokens.
 */
export function buildName(ch: NormalizedChannel, n: NamingSettings, maxLength: number): { full: string; clipped: string } {
  const parts = n.components
    .map((t) => resolveToken(t, ch, n))
    .map((p) => sanitize(p, { transliterate: n.transliterate, uppercase: n.uppercase }))
    .filter(Boolean);
  let full = parts.join(n.separator);

  if (!full && ch.source_type === "channel_pack") {
    const fallback = ch.name_hint || ch.channel || ch.label || ch.category || "PACK";
    full = sanitize(fallback, { transliterate: n.transliterate, uppercase: n.uppercase });
  }

  const clipped = maxLength > 0 ? full.slice(0, maxLength) : full;
  return { full, clipped };
}

export function resolveCollisions(
  channels: NormalizedChannel[],
  n: NamingSettings,
): { channels: NormalizedChannel[]; unresolved: number } {
  const seen = new Map<string, number>();
  let unresolved = 0;
  const max = n.maxLength > 0 ? n.maxLength : Infinity;

  for (const ch of channels) {
    const name = ch.generated_name_final || "NONAME";
    if (!seen.has(name)) {
      seen.set(name, 1);
      ch.generated_name_final = name;
      continue;
    }
    ch.collided = true;
    if (n.collisionPolicy === "stop") {
      unresolved++;
      continue;
    }
    let attempt = 1;
    let candidate = name;
    while (seen.has(candidate)) {
      if (n.collisionPolicy === "numeric_suffix") {
        const suffix = String(attempt);
        const base = name.slice(0, Math.max(1, Math.min(name.length, max - suffix.length)));
        candidate = (base + suffix).slice(0, max);
      } else {
        const suffix = String.fromCharCode(64 + Math.min(26, attempt));
        const base = name.slice(0, Math.max(1, Math.min(name.length, max - 1)));
        candidate = (base + suffix).slice(0, max);
      }
      attempt++;
      if (attempt > 200) { unresolved++; break; }
    }
    seen.set(candidate, 1);
    ch.generated_name_final = candidate;
  }
  return { channels, unresolved };
}
