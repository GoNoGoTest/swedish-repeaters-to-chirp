## Mål

Hantera RX-only korrekt per target — utan att läcka CHIRP-specifika hack (`duplex === "off"`) till andra target.

## 1. Nicsure RT-880 (`src/lib/codeplug/targets/nicsure-rt880.ts`)

**Beteende för RX-only**:
- `TX_Power = "N/T"` (literal, ny tillåten typ)
- `TX = RX` (samma frekvens, ingen offset, ingen 0.00000)
- Övriga kolumner oförändrade

**Detektion**: `c.rx_only || !c.tx_allowed` — inte `c.duplex === "off"`.

**Ändringar i koden**:
- `NicsurePower`-typen utökas: `"Very High" | "High" | "Medium" | "Low" | "N/T"`. `defaultPower` accepterar inte "N/T" i UI:t men typen tillåter det för row-level override.
- `mobileTxMhz(c)`: ta bort `if (c.duplex === "off") return 0;`. För RX-only returnera `c.rx_frequency` direkt (innan duplex-shift-grenen).
- I `toNicsureRows` rad-loopen: om `c.rx_only || !c.tx_allowed`, sätt `TX_Power: "N/T"` istället för `s.defaultPower`. Räkna upp en ny counter `rxOnlyCount` istället för `txBlocked`.
- Ta bort warning-koden `nicsure_tx_block_unsupported`. Ersätt med ny kod `nicsure_rx_only_marked` med meddelande typ: `"{n} kanal(er) är RX-only: TX_Power satt till N/T, TX=RX."` (informativ, inte en varning om hack).

## 2. RT-Systems Yaesu (`src/lib/codeplug/targets/rt-systems-yaesu.ts`)

**Beteende för RX-only**: exkluderas helt ur exporten. Varning visas.

**Ändringar i koden**:
- I `exportRtSystemsYaesuCsv`: filtrera bort `c.rx_only || !c.tx_allowed` innan loopen, räkna antalet skippade.
- Lägg till warning-kod `rt_rx_only_excluded` med meddelande: `"{n} kanal(er) är RX-only och exkluderades — vi saknar information om hur RT Systems markerar RX-only i CSV:n."`
- `formatOffsetFrequency`: ta bort `|| c.duplex === "off"`-grenen (chirp-leftover). Yaesu ser aldrig duplex="off" eftersom RX-only-rader filtreras bort innan, och simplex hanteras redan av `c.duplex === ""`.
- `mobileTxMhz`: ingen ändring behövs (duplex="off" når aldrig hit).

## 3. Modeller (`src/lib/codeplug/models.ts`)

Lägg till nya warning-koder i `WarningCode`-unionen:
- `"nicsure_rx_only_marked"` (ersätter `"nicsure_tx_block_unsupported"`)
- `"rt_rx_only_excluded"` (ny)
- Ta bort `"nicsure_tx_block_unsupported"` (inte längre använd).

## 4. Tester

**`src/lib/codeplug/__tests__/targets/nicsure-rt880.test.ts`**:
- Existerande test `"duplex=off writes TX=0.00000 …"` skrivs om till `"rx_only writes TX=RX, TX_Power=N/T and emits nicsure_rx_only_marked warning"`. Använd `rx_only: true, tx_allowed: false` istället för `duplex: "off"`. Förvänta `row[4] === "161.00000"` (TX=RX), `row[7] === "N/T"` (TX_Power), och `nicsure_rx_only_marked`-warning.

**`src/lib/codeplug/__tests__/targets/rt-systems-yaesu.test.ts`** (nya test):
- "rx_only channels are excluded and emit rt_rx_only_excluded warning"
- Verifiera att en RX-only-rad inte producerar någon rad i CSV:n och att rätt warning finns med rätt count.

## 5. Påverkan på preview / övrig kod

Ingen ändring i pipelinen (`rxOnlyPolicy=block_tx` fortsätter sätta `duplex="off"` — krävs av CHIRP). Förhandsgranskningen påverkas inte. UI:t för Nicsure behöver inte exponera "N/T" som val för `defaultPower` — det är ett automatiskt per-rad-värde.

## Sammanfattning

CHIRP behåller `duplex="off"` som TX-disable-hack (radiomotiverat). Nicsure och Yaesu läser istället `rx_only`/`tx_allowed` direkt och hanterar det på target-naturligt sätt: Nicsure med `TX_Power=N/T` + TX=RX, Yaesu med exkludering + varning.