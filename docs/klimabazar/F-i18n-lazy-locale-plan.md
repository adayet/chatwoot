# F-i18n — Lazy-load tłumaczeń — plan implementacji

Patrz `F-i18n-lazy-locale-design.md`. Marker `KLIMABAZAR F-i18n`.

## Task 1: `dashboard/i18n/index.js` — fallback en + loader dynamiczny
- Usunąć 41 statycznych importów i `export default { ... }`.
- `import en from './locale/en';`
- `const localeLoaders = import.meta.glob('./locale/*/index.js');`
- `export default en;` (default = fallback) oraz `export { en };`
- `export async function loadLocaleMessages(i18nGlobal, locale)` wg designu (guard: pusty/en/już-załadowany/nieznany).
- Komentarz `// KLIMABAZAR F-i18n`.

## Task 2: `entrypoints/dashboard.js` + `entrypoints/v3app.js`
- Import: `import en, { loadLocaleMessages } from 'dashboard/i18n';` (zamiast `i18nMessages`).
- `createI18n({ legacy:false, locale:'en', fallbackLocale:'en', messages:{ en } })`.
- Przed `app.mount('#app')`:
  ```js
  const active = window.chatwootConfig?.selectedLocale || 'en';
  await loadLocaleMessages(i18n.global, active);
  i18n.global.locale.value = active;
  ```
- dashboard.js montuje w `window.onload = () => {...}` → zrobić handler `async`.
- v3app.js montuje na końcu modułu → owinąć w `async`/IIFE lub `.then`.
- Uwaga: import default zmienił sens (en, nie obiekt-wszystkich); zweryfikować brak innych użyć default.

## Task 3: `App.vue → setLocale` async
- `import { loadLocaleMessages } from 'dashboard/i18n';`
- `async setLocale(locale){ if(!locale) return; await loadLocaleMessages(this.$root.$i18n, locale); this.$root.$i18n.locale = locale; }`
- Wywołania w `mounted()`/`initializeAccount()` zostają (fire-and-forget OK — locale doczyta się i przełączy; aktywny i tak preloadowany w entrypoincie).

## Task 4: Rejestr + BACKLOG
- Wiersz w `CUSTOMIZATIONS.md` (3 pliki + glob).
- Zaznaczyć w `BACKLOG.md`.

## Task 5: Weryfikacja
- Build w Dockerze (parytet) lub CI; analiza chunków:
  - `grep -c SEARCH_PLACEHOLDER` w chunku startowym → ~1 (było 1643).
  - Obecność osobnych chunków per język (`pl-*.js` itd.).
  - Rozmiar startowego DashboardIcon/entry spada o ~7 MB.
- Playwright/Firefox (lokalny dev `:3001` lub prod po deployu): PL na starcie, przełączanie języka doczytuje i działa, brak migotania, login po polsku.

## Self-Review (po napisaniu)
- Czy `i18n.global.locale.value` to poprawny zapis (Composer, legacy:false)? — tak.
- Czy `this.$root.$i18n` ma `setLocaleMessage`/`availableLocales`? — tak (global Composer).
- Czy fallbackLocale ustawiony, by nieznany język nie dawał pustych kluczy? — tak (`en`).
- Czy aktywny locale doczytany PRZED ustawieniem `.locale` (brak migotania)? — tak (await w entrypoincie).
