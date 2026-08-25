import { defineConfig } from 'vite';
import ruby from 'vite-plugin-ruby';
import vue from '@vitejs/plugin-vue';
import { aliases, vueOptions } from './vite.shared';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  plugins: [ruby(), vue(vueOptions), yaml()],
  // KLIMABAZAR (tylko lokalny dev w Dockerze): proxy vite_ruby forwarduje Host kontenera
  // (np. "vite"), który Vite 5.4 blokuje (allowedHosts → 403). Flaga w override luzuje to
  // wyłącznie lokalnie; bez env to {} = zero wpływu na upstream/prod (prod nie odpala dev-servera).
  server:
    process.env.VITE_ALLOW_ALL_HOSTS === 'true' ? { allowedHosts: true } : {},
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  resolve: { alias: aliases },
});
