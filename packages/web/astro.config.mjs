// packages/web/astro.config.mjs — Evo Titan
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://evotitan.app',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
