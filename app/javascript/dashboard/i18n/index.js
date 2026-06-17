// KLIMABAZAR F-i18n: lazy-load tłumaczeń. Zamiast statycznego importu 41 języków
// (~7 MB w chunku startowym) ładujemy tylko EN (fallback) na sztywno, a aktywny język
// doczytujemy dynamicznie - każdy `() => import()` to osobny chunk on-demand.
// Patrz docs/klimabazar/F-i18n-lazy-locale-design.md.
//
// UWAGA: jawna mapa (nie import.meta.glob), bo katalogów locale jest więcej (~56) niż
// wspieranych języków (41) i część dodatkowych jest niekompletna (np. `zh` bez wszystkich
// JSON-ów) - glob wciągałby je do builda i go wywracał. Lista = ta sama co w upstreamie.
import en from './locale/en';

const localeLoaders = {
  ar: () => import('./locale/ar'),
  bg: () => import('./locale/bg'),
  ca: () => import('./locale/ca'),
  cs: () => import('./locale/cs'),
  da: () => import('./locale/da'),
  de: () => import('./locale/de'),
  el: () => import('./locale/el'),
  es: () => import('./locale/es'),
  et: () => import('./locale/et'),
  fa: () => import('./locale/fa'),
  fi: () => import('./locale/fi'),
  fr: () => import('./locale/fr'),
  he: () => import('./locale/he'),
  hi: () => import('./locale/hi'),
  hu: () => import('./locale/hu'),
  id: () => import('./locale/id'),
  it: () => import('./locale/it'),
  ja: () => import('./locale/ja'),
  ko: () => import('./locale/ko'),
  lv: () => import('./locale/lv'),
  ml: () => import('./locale/ml'),
  nl: () => import('./locale/nl'),
  no: () => import('./locale/no'),
  pl: () => import('./locale/pl'),
  pt: () => import('./locale/pt'),
  pt_BR: () => import('./locale/pt_BR'),
  ro: () => import('./locale/ro'),
  ru: () => import('./locale/ru'),
  sk: () => import('./locale/sk'),
  sr: () => import('./locale/sr'),
  sv: () => import('./locale/sv'),
  ta: () => import('./locale/ta'),
  th: () => import('./locale/th'),
  tr: () => import('./locale/tr'),
  uk: () => import('./locale/uk'),
  vi: () => import('./locale/vi'),
  zh_CN: () => import('./locale/zh_CN'),
  zh_TW: () => import('./locale/zh_TW'),
  is: () => import('./locale/is'),
  lt: () => import('./locale/lt'),
};

// Doczytuje wiadomości danego locale do instancji vue-i18n (i18n.global / Composer).
// No-op dla EN (już w bundlu), już-załadowanego lub nieznanego języka (zostaje fallback EN).
export async function loadLocaleMessages(i18nGlobal, locale) {
  if (!locale || locale === 'en') return;
  if (i18nGlobal.availableLocales.includes(locale)) return;
  const load = localeLoaders[locale];
  if (!load) return;
  const mod = await load();
  i18nGlobal.setLocaleMessage(locale, mod.default);
}

export { en };
export default en;
