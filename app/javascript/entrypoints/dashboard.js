import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';

import axios from 'axios';
// Global Components
import hljsVuePlugin from '@highlightjs/vue-plugin';

import { plugin, defaultConfig } from '@formkit/vue';
import WootWizard from 'components/ui/Wizard.vue';
import FloatingVue from 'floating-vue';
import WootUiKit from 'dashboard/components';
import App from 'dashboard/App.vue';
// KLIMABAZAR F-i18n: default = EN (fallback); aktywny język doczytywany dynamicznie.
import en, { loadLocaleMessages } from 'dashboard/i18n';
import createAxios from 'dashboard/helper/APIHelper';

import commonHelpers, { isJSONValid } from 'dashboard/helper/commons';
import { sync } from 'vuex-router-sync';
import { createPinia } from 'pinia';
import router, { initalizeRouter } from 'dashboard/routes';
import store from 'dashboard/store';
import constants from 'dashboard/constants/globals';
import * as Sentry from '@sentry/vue';
import {
  initializeAnalyticsEvents,
  initializeChatwootEvents,
} from 'dashboard/helper/scriptHelpers.js';
import FluentIcon from 'shared/components/FluentIcon/DashboardIcon.vue';
import VueDOMPurifyHTML from 'vue-dompurify-html';
import { domPurifyConfig } from 'shared/helpers/HTMLSanitizer.js';

import { vResizeObserver } from '@vueuse/components';
import { directive as onClickaway } from 'vue3-click-away';

import 'floating-vue/dist/style.css';

const i18n = createI18n({
  legacy: false, // https://github.com/intlify/vue-i18n/issues/1902
  locale: 'en',
  fallbackLocale: 'en', // KLIMABAZAR F-i18n: nieznany/niedoczytany język -> EN
  messages: { en },
});

sync(store, router);

const pinia = createPinia();

const app = createApp(App);
app.use(i18n);
app.use(store);
app.use(pinia);
app.use(router);

// [VITE] Disabled this, need to renable later
if (window.errorLoggingConfig) {
  Sentry.init({
    app,
    dsn: window.errorLoggingConfig,
    denyUrls: [
      // Chrome extensions
      /^chrome:\/\//i,
      /chrome-extension:/i,
      /extensions\//i,

      // Locally saved copies
      /file:\/\//i,

      // Safari extensions.
      /safari-web-extension:/i,
      /safari-extension:/i,
    ],
    integrations: [Sentry.browserTracingIntegration({ router })],
    ignoreErrors: [
      'ResizeObserver loop completed with undelivered notifications',
    ],
  });
}

app.use(VueDOMPurifyHTML, domPurifyConfig);
app.use(WootUiKit);
app.use(
  plugin,
  defaultConfig({
    rules: {
      JSON: ({ value }) => isJSONValid(value),
    },
  })
);
app.use(FloatingVue, {
  instantMove: true,
  arrowOverflow: false,
  disposeTimeout: 5000000,
});
app.use(hljsVuePlugin);

app.component('woot-wizard', WootWizard);
app.component('fluent-icon', FluentIcon);

app.directive('resize', vResizeObserver);
app.directive('on-clickaway', onClickaway);

// load common helpers into js
commonHelpers();
window.WootConstants = constants;
window.axios = createAxios(axios);
// [VITE] Disabled this we don't need it, we can use `useEmitter` directly
// app.prototype.$emitter = emitter;

initializeChatwootEvents();
initializeAnalyticsEvents();
initalizeRouter();

// KLIMABAZAR F-boot: po deployu stare lazy-chunki zwracaja 404 (karta otwarta przez
// deploy) -> vite:preloadError. Bez obslugi = bialy ekran/zepsuty widok. Przeladuj raz
// (pobiera swiezy index.html z nowymi hashami); guard chroni przed petla reloadow.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'kbChunkReloadedAt';
  const last = Number(window.sessionStorage?.getItem(KEY) || 0);
  if (Date.now() - last < 10000) return; // juz proba reloadu < 10s temu -> nie zapetlaj
  window.sessionStorage?.setItem(KEY, String(Date.now()));
  window.location.reload();
});

window.onload = async () => {
  // KLIMABAZAR F-i18n: doczytaj aktywny język PRZED mount (brak migotania EN->PL;
  // await pokrywa loader F-boot). Fallback EN gdy locale nieznany/nie doczyta się.
  const activeLocale = window.chatwootConfig?.selectedLocale || 'en';
  await loadLocaleMessages(i18n.global, activeLocale);
  i18n.global.locale.value = activeLocale;

  app.mount('#app');
  // KLIMABAZAR F-boot: usuwanie loadera obsluguje wspolny MutationObserver w
  // layoucie (_kb_boot_fallback) - dziala dla wszystkich packow, nie tylko tego.
};
