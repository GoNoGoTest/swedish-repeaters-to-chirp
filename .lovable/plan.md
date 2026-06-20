## Mål

Gör RX-only-policyn target-agnostisk. Användarens val ska uttrycka **intent**, inte CHIRP-specifik mekanik. Varje target översätter intenten till sitt eget filformat — inga nya UI-komponenter per radio.

## Vad som är fel idag

- `RxOnlyPolicy = "duplex_off"` är döpt efter CHIRP-CSV:ns `Duplex=off`.
- Pipeline (`applyRxOnlyPolicy`) muterar `ch.duplex = "off"` direkt. CHIRP plockar upp det automatiskt; VGC N76 ignorerar `duplex=off` och har en parallell egen path som läser `rx_only || !tx_allowed` rakt från kanalen (dubbel sanning); Nicsure RT-880 saknar TX-spärr helt och skriver tyst TX=RX (kanalen sänder på rx-frekvensen om PTT trycks).
- UI:t (ExportPanel) säger "Exportera som Duplex=off (rekommenderas)" oavsett vald radio.

## Lösning: generisk `block_tx`-intent

### 1. `models.ts`

Byt `RxOnlyPolicy`:

```text
"mark" | "duplex_off" | "skip" | "stop"
  ->
"mark" | "block_tx" | "skip" | "stop"
```

Defaults: `rxOnlyPolicy: "block_tx"` (i `defaults.ts`).

Ingen migrering — appen är inte släppt och saved-exports innehåller inte policy-värdet.

### 2. `pipeline.ts` – `applyRxOnlyPolicy`

`case "block_tx"` sätter en **portabel signal**: `ch.duplex = "off"`. Det är redan modellens enda fält som betyder "ingen TX" och alla targets kan läsa det. Ingen ny fält-typ behövs.

Lägg till varningskod `rx_only_blocked` (ersätter implicit beteende) — text: "RX-only: TX spärrad enligt target-konvention".

### 3. Per target: översätt `duplex === "off"` till native TX-spärr

Varje target äger sin egen mappning. Pipelinen säger bara "TX är spärrad" — exportern översätter.

**CHIRP (`exporters/chirp.ts`)**: redan korrekt (`Duplex=off` skrivs). Ingen ändring.

**VGC N76 (`targets/vgc-n76.ts`)**: ändra `tx_dis`-raden så den triggar på `duplex === "off"` *också*, inte bara `rx_only || !tx_allowed`. Behåll de andra två som fallback (en sk6ba-rad kan vara markerad rx_only utan att ha kört genom rx-only-policyn — säkrare att OR:a). Ingen ny UI-yta.

**Nicsure RT-880 (`targets/nicsure-rt880.ts`)**: RT-880-CSV:n har ingen TX-disable-kolumn. Konvention:
- `mobileTxMhz` returnerar `0` när `duplex === "off"` (skriver `TX = 0.00000`), vilket är den mest portabla "no TX"-signalen i fil­format som inte har egen flagga.
- Lägg till varning `nicsure_tx_block_unsupported` (en gång per export, räknad) som förklarar att TX=0 används och att radio­operatören måste låsa kanalen i RMS om hen vill ha riktig spärr.

(Alternativ: skriv TX=RX som idag och bara varna. Förslag ovan är hårdare — diskutera om du föredrar det.)

### 4. UI (`ExportPanel.tsx`)

- Byt option-label från "Exportera som Duplex=off (rekommenderas)" till **"Spärra TX i radion (rekommenderas)"**.
- Hint för fältet: "Hur kanalen ska sända: 'Spärra TX' använder respektive radios egna metod (CHIRP Duplex=off, VGC tx_dis=1, RT-880 TX=0)."
- Inga per-target-komponenter för RX-only.

### 5. Tester

- Uppdatera `pipeline.test.ts`: byt `"duplex_off"` → `"block_tx"`, samma assertion (`duplex === "off"`).
- VGC: nytt test som verifierar att en kanal med `duplex === "off"` (utan rx_only-flagga) får `tx_dis = "1"`.
- Nicsure: nytt test som verifierar `TX = "0.00000"` och `nicsure_tx_block_unsupported`-varning för blockerade rader.

## Filer som ändras

- `src/lib/codeplug/models.ts`
- `src/lib/codeplug/defaults.ts`
- `src/lib/codeplug/pipeline.ts`
- `src/lib/codeplug/targets/vgc-n76.ts`
- `src/lib/codeplug/targets/nicsure-rt880.ts`
- `src/components/codeplug/ExportPanel.tsx`
- `src/lib/codeplug/__tests__/pipeline.test.ts`
- `src/lib/codeplug/__tests__/targets/vgc-n76.test.ts`
- `src/lib/codeplug/__tests__/targets/nicsure-rt880.test.ts`

## Frågor (svara gärna före implementation)

1. Nicsure utan TX-disable: föredrar du **TX=0.00000 + varning** (förslaget) eller **TX=RX + varning** (dagens beteende men med varning)?
2. Vill du behålla termen "RX-only" i UI:t eller döpa om sektionen till "TX-spärr för RX-only-kanaler" för att matcha den nya intenten?