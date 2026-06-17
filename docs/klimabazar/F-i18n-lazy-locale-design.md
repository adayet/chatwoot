# F-i18n — Lazy-load tłumaczeń (chunk startowy bez 40 nieużywanych języków)

## Cel biznesowy
Skrócić czas startu panelu (i logowania) dla pracowników na wolniejszych łączach.
Diagnoza 2026-06-17: startowy chunk `DashboardIcon-*.js` ważył 12,27 MB i ładował się
~29 s (Firefox/Windows, wolne łącze) → biały ekran. Doraźnie: kompresja Caddy
(12,27 → 3,3 MB zstd) + loader F-boot. Ten feature usuwa przyczynę u źródła.

## Ustalenia (analiza forensyczna 2026-06-17)
Rozkład chunku (12,27 MB) z source-mapy + skanu literałów:
- **~7,3 MB — i18n wszystkich 41 języków** (dominanta). Marker `SEARCH_PLACEHOLDER`
  występuje w chunku 1643×, `EMPTY_STATE` 1476× = te same klucze ×~40 języków.
  Źródła locale: 26 MB; instalacja używa tylko `en` + `pl` (~0,93 MB).
- ~0,6–1 MB — `@twilio/voice-sdk` (rozmowy WhatsApp) → **faza 2** (poza tym feature).
- ~0,5 MB — @vueuse/core, pinia, sentry.
- ~0,11 MB — faktyczne ikony (`viewBox` w chunku tylko 2× — nazwa pliku myli).

## Stan zastany (zweryfikowany)
- `dashboard/i18n/index.js`: 41 statycznych `import xx from './locale/xx'` + `export default { ... }`.
- Konsumenci: **tylko** `entrypoints/dashboard.js` i `entrypoints/v3app.js`
  (`import i18nMessages from 'dashboard/i18n'` → `createI18n({ legacy:false, locale:'en', messages })`).
  `preChat.js` używa **widget**/i18n (nie dotyczy). `histoire.setup.ts` — dev.
- Przełączanie locale w locie: `App.vue → setLocale(locale)` (`this.$root.$i18n.locale = locale`),
  wołane w `mounted()` i `initializeAccount()` z `uiSettings.locale || selectedLocale || account.locale`.
- `locale/<xx>/index.js` agreguje JSON-y danego języka (per-katalog).
- vue-i18n w trybie `legacy:false` → `i18n.global` to Composer z `setLocaleMessage()` i
  `availableLocales`; `this.$root.$i18n` == `i18n.global` (globalInjection).

## Architektura zmiany

### 1. `dashboard/i18n/index.js` — fallback statyczny + loader dynamiczny
Zamiast 41 importów i agregatu:
```js
import en from './locale/en';                            // fallback ZAWSZE w bundlu (~150 KB min)
const localeLoaders = import.meta.glob('./locale/*/index.js'); // Vite: chunk-per-język, on-demand
export { en };
export async function loadLocaleMessages(i18nGlobal, locale) {
  if (!locale || locale === 'en') return;
  if (i18nGlobal.availableLocales.includes(locale)) return; // juz zaladowany
  const load = localeLoaders[`./locale/${locale}/index.js`];
  if (!load) return;                                        // nieznany locale -> fallback EN
  const mod = await load();
  i18nGlobal.setLocaleMessage(locale, mod.default);
}
```
`import.meta.glob` (bez `eager`) daje mapę `ścieżka → () => import()`; każdy język ląduje w
osobnym chunku ładowanym dopiero przy użyciu.

### 2. `entrypoints/dashboard.js` i `v3app.js` — start z EN + doczytanie aktywnego locale
```js
import en, { loadLocaleMessages } from 'dashboard/i18n';   // default = en
const i18n = createI18n({ legacy:false, locale:'en', fallbackLocale:'en', messages:{ en } });
...
// przed app.mount (loader F-boot pokrywa await -> brak migotania):
const active = window.chatwootConfig?.selectedLocale || 'en';
await loadLocaleMessages(i18n.global, active);
i18n.global.locale.value = active;
app.mount('#app');
```
(Uwaga: `default export` index.js zmienia się z obiektu-wszystkich-języków na `en`.)

### 3. `App.vue → setLocale` — doczytaj locale przed przełączeniem
```js
async setLocale(locale) {
  if (!locale) return;
  await loadLocaleMessages(this.$root.$i18n, locale); // KLIMABAZAR F-i18n
  this.$root.$i18n.locale = locale;
}
```
Obsługuje przełączanie w `UserLanguageSelect` (idzie przez `setLocale`) oraz start z konta.

## Pliki (rejestr do CUSTOMIZATIONS.md)
- `dashboard/i18n/index.js` — **przepisany** (eager 41 → fallback en + `loadLocaleMessages`). Backend-niezależny, ale **upstream-owy → czulszy przy mergach**.
- `entrypoints/dashboard.js`, `entrypoints/v3app.js` — createI18n z `{en}` + await aktywnego locale przed mount.
- `dashboard/App.vue` — `setLocale` async z doczytaniem.

## Decyzje i kompromisy (MVP)
- `en` zostaje statycznie (fallback zawsze dostępny bez async; ~150 KB to akceptowalny koszt).
- Aktywny locale doczytywany **przed** mount → brak migotania EN→PL; wait pokrywa loader F-boot.
- Twilio i inne ciężkie zależności — osobno (faza 2), poza tym feature.

## Poza zakresem (YAGNI)
- Lazy-load Twilio / vueuse (faza 2).
- Zmiana `build.target` / `@vitejs/plugin-legacy`.
- Lazy widget i18n (osobny pack, inny problem).

## Jak zweryfikować
- Build (Docker/CI) + analiza: chunk startowy spada o ~7 MB; pojawiają się chunki
  `xx-<hash>.js` per język; w chunku startowym `SEARCH_PLACEHOLDER` ~1× (tylko en), nie 1643×.
- Playwright/Firefox: start z `selectedLocale=pl` → UI po polsku; przełączenie języka w
  profilu doczytuje chunk i przełącza; brak migotania; login (v3app) też po polsku.
- Brak regresji: nieznany locale → fallback EN (nie pusty klucz).

## Kandydat na PR do upstreamu
Tak — Chatwoot wysyła wszystkie języki wszystkim użytkownikom; lazy-load to czysta
optymalizacja niezależna od instalacji. Niska kruchość mergów (zmieniamy mechanizm, nie listę).
