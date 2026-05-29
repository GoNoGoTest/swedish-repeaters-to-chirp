## Orsak

`useState<Settings>(() => loadStoredSettings())` på rad 77 läser `localStorage` synkront under första klient-renderingen. Servern (SSR/prerender) har ingen `window` → får `DEFAULT_SETTINGS` (0 valda paket). Klienten läser sin sparade selection (t.ex. 8 valda) redan i första renderingen → text-noden blir "8" vs "0" → hydration mismatch i `ChannelPacksPanel`-headern.

Samma mönster är redan löst korrekt strax under för `savedExports` (mountas tomt, hydreras i `useEffect`).

## Fix

Ändra `src/routes/index.tsx`:

```ts
const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
const [settingsHydrated, setSettingsHydrated] = useState(false);

useEffect(() => {
  setSettings(loadStoredSettings());
  setSettingsHydrated(true);
}, []);

useEffect(() => {
  if (!settingsHydrated) return; // undvik att skriva tillbaka DEFAULT över sparade
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}, [settings, settingsHydrated]);
```

`settingsHydrated`-flaggan behövs för att den befintliga persist-`useEffect` annars körs en gång med `DEFAULT_SETTINGS` innan hydreringen hinner sätta sparade värden, och skulle skriva över localStorage.

## Verifiera

- Ladda om sidan med valda paket → ingen hydration-varning i konsollen.
- Selection bibehålls efter omladdning (localStorage skrivs inte över).
- Vid första renderingen visas kort "0 valda" innan localStorage hydreras — acceptabelt, samma mönster som `savedExports`.

## Inte berört

Övrig hydrerings-säker logik (savedExports) är redan korrekt.
