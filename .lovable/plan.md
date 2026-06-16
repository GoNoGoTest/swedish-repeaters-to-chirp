
## Mål

Lägg till en sektion högst upp på sidan (`src/routes/index.tsx`) med:

- Länk till SK6BA:s repeaterkarta: https://sk6ba.se/vhf/repeater/karta/ (där användaren hämtar CSV-filen)
- Länk till GitHub-repot: https://github.com/GoNoGoTest/swedish-repeaters-to-codeplug/
- Notering att projektet distribueras under MIT-licens (länkad till `LICENSE`-filen på GitHub)

## Layout

Liten header ovanför nuvarande innehåll:

```text
Swedish Repeaters → Codeplug
Hämta CSV från SK6BA:s repeaterkarta · GitHub · MIT-licens
```

Diskret stil (muted-foreground, små länkar med underline-on-hover), inga stora hero-element — verktyget är funktionellt och ska inte tryckas ner.

## Saknar jag något?

Förslag på sånt som ofta hör hemma i en sån header — säg till om du vill ha med något:

1. **Versionsnummer / build** från `package.json` (synligt så användaren vet vad de kör)
2. **"Privacy"-rad**: "All bearbetning sker lokalt i din webbläsare — inga filer laddas upp" (står i README, värt att kommunicera i UI:t också)
3. **Kort en-meningsbeskrivning** av vad verktyget gör, för förstagångsbesökare
4. **Issue/bug-länk** direkt till GitHub Issues

Säg vilka (om några) av 1–4 du vill ha med, så bygger jag.
