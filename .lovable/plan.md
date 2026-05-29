## Analys

Den andra LLM:n har rätt. `parseAccess()` returnerar bara `{ctcss, uses1750}` — alla andra värden (Carrier, "ingen", "open", tomt) hamnar i samma "okänt"-fack och triggar `missing_access_tone`-varningen i `pipeline.ts:51`.

**"Carrier" är en explicit accessmetod** = öppen bärvågstrigger, ingen ton. Den ska inte varna.

## Fix

**1. `src/lib/chirp/tones.ts`** — utöka `ToneParse`:
```ts
export interface ToneParse {
  ctcss: number | null;
  uses1750: boolean;
  carrier: boolean;     // explicit "Carrier" / "open" / "no tone"
}
```

Lägg till detektion i `parseAccess()` innan candidates-loopen — om någon del matchar `/^(carrier|open|none|ingen|no\s*tone)$/i` → `carrier=true`.

**2. `src/lib/chirp/pipeline.ts:46-52`** — skippa varningen när `access.carrier` är true:
```ts
if (!access.ctcss && !access.uses1750 && !access.carrier && r.access) {
  warnings.push({ code: "missing_access_tone", ... });
}
```

Comment-strängen behåller redan `access=Carrier` (rad 65–67), så användaren ser ändå informationen.

**3. Export (`exporters/chirp.ts`)** — ingen ändring behövs. SK6BA-rader utan `ctcss_tx` exporteras redan med tomma ton-fält (`resolveToneFields`). Carrier → `ctcss_tx=null` → tomma fält. ✅

**4. Tester** — i `__tests__/tones.test.ts`:
- `parseAccess("Carrier")` → `{ctcss: null, uses1750: false, carrier: true}`
- `parseAccess("1750/Carrier")` → carrier=true, uses1750=true (bevarad)
- `parseAccess("88.5")` → carrier=false

Plus uppdatera befintliga `toEqual({ctcss, uses1750})`-assertions till att inkludera `carrier: false`.

## Inte berört

- Hydreringsvarningen "8 vs 0" i `ChannelPacksPanel` (separat fråga — säg till om jag ska titta på den).
