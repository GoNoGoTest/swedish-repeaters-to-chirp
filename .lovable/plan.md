## Mål

Snygga till statistikpanelen i "Förhandsgranska & exportera". Ta bort brus, byt etiketter och dela upp den kombinerade varnings-räknaren i fyra separata rutor med egen tooltip.

## Ny stat-rad

Sex rutor i grid (`md:grid-cols-3 lg:grid-cols-6`):

```
Från SK6BA · Från kanalpaket · Varningar · Namnkollisioner · Frekvensdubbletter · RX-only
```

- Borttagna: **Input totalt** och **Filtrerade bort** (de finns redan i Repeater-sektionens stat-rad ovanför).
- Omdöpt:
  - `SK6BA` → **Från SK6BA**
  - `Kanalpaket` → **Från kanalpaket**
- Den gamla rutan `Varn/Koll/Dupes/RX` (t.ex. "27/23/0/0") delas upp i fyra rutor, var och en med egen tooltip som förklarar vad siffran betyder och var den kommer ifrån.

## Tooltips per varningsruta

Tooltips återanvänder befintlig `tooltip?`-prop på `Stat`-komponenten (HTML-`title`, redan implementerad).

- **Varningar** (`stats.warned`):
  > Antal exportkanaler som har minst en varning (t.ex. RX-only-policy, otydlig access, namnsaknad). Kanalerna exporteras ändå, men kolla preview-tabellen för detaljer.

- **Namnkollisioner** (`stats.collided`):
  > Kanaler där det genererade namnet krockar med ett annat. Suffixsystemet har försökt göra dem unika — justera namnmallen om något fortfarande är otydligt.

- **Frekvensdubbletter** (`stats.dupes`):
  > Kanaler som delar RX-frekvens med en annan kanal (oftast pack-vs-SK6BA). Påverkar inte exporten om policy är "behåll båda", men kan duplicera kanalplatser i radion.

- **RX-only** (`stats.rxOnly`):
  > Kanaler från kanalpaket som är mottagningsbara men inte sändningsbara. Hur de exporteras beror på den valda RX-only-policyn (markerad i comment, TX spärrad eller stoppar export).

Tooltips visas bara via `title`-attributet (native browser tooltip) — samma mekanism som vi använder för "Bortfiltrerade" i Repeater-sektionen, så ingen ny komponent behövs.

## Filer som ändras

- `src/routes/index.tsx` — bygg om grid-blocket på rad 306–312:
  - Ta bort `Input totalt` och `Filtrerade bort`.
  - Byt label på SK6BA och Kanalpaket.
  - Ersätt den kombinerade `Varn/Koll/Dupes/RX`-rutan med fyra separata `<Stat …tooltip={…} />`.
  - Justera grid-klasser till `md:grid-cols-3 lg:grid-cols-6` (6 lika breda kolumner på desktop, 3 på mellanstorlek, 2 på mobil — matchar nuvarande proportioner).

Inga andra filer behöver röras. Inga nya tester (rena UI-textetiketter och tooltips).
