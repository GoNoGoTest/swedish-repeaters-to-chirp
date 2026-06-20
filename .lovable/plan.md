## Ändring

Utöka **Distrikt**-dimensionen för Nicsure-zoner så att den även täcker kanalpaket. Idag returnerar `dimensionValue(c, "district")` `null` för paketrader (de saknar `region.districtLabel`), vilket gör att paketkanaler får tomma Slot-bokstäver på den dimensionen. Användaren vill att Distrikt-dimensionen ska "alla kanaler i någon grupp": repeatrar grupperas på SM6/LA/OZ, paketkanaler grupperas på sitt paket.

## Implementation

I `src/lib/codeplug/targets/nicsure-rt880.ts`, i `dimensionValue` case `"district"`:

```text
1. Om c.region.districtLabel finns → returnera den (oförändrat, t.ex. "SM6", "LA").
2. Annars om c.pack_id är icke-tomt → returnera pack_id (t.ex. "se_marine_vhf_rx_channel_pack").
3. Annars → null.
```

Uppdatera även beskrivningen i `NICSURE_ZONE_DIMENSIONS`:

```text
"Distrikt" / "Repeaterdistrikt (SM6, LA, OZ) eller kanalpakets-id för paketrader."
```

Inget annat ändras — letter-poolen, legenden och slotmappningen fungerar oförändrat eftersom de bara läser strängvärden via `dimensionValue`. Användaren namnger bokstäverna fritt i Nicsure RMS.

## Test

I `src/lib/codeplug/__tests__/targets/nicsure-rt880.test.ts`: lägg till ett test som verifierar att en repeater (district=SM6) och en paketkanal (pack_id=se_marine_vhf) får olika bokstäver i Slot1 när Slot1=district.

## Filer

- `src/lib/codeplug/targets/nicsure-rt880.ts`
- `src/lib/codeplug/__tests__/targets/nicsure-rt880.test.ts`

## Fråga

Föredrar du `pack_id` (stabilt internt id, t.ex. `se_marine_vhf_rx_channel_pack`) eller `category` (t.ex. `marine`) som värde för paketrader i Distrikt-dimensionen? Pack_id ger en bokstav per paket; category samlar flera paket av samma typ under en bokstav. Förslaget ovan använder `pack_id`.