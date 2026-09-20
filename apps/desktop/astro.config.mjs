// apps/desktop/astro.config.mjs — Evo Titan
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Tauri loads the static build output from src-tauri/../dist.
  output: 'static',
  server: {
    // Tauri's devUrl is fixed at http://localhost:4321, so the dev server must
    // always use this port. `strictPort` is a Vite option, not an Astro one.
    port: 4321,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      strictPort: true,
    },
    // Tauri expects a fixed port and does not need HMR websocket locking.
    clearScreen: false,
  },
});
