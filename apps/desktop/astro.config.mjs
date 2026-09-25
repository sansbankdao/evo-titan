// apps/desktop/astro.config.mjs — Evo Titan
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Tauri loads the static build output from src-tauri/../dist.
  output: 'static',
  server: {
    // Must match `build.devUrl` in src-tauri/tauri.conf.json exactly.
    //
    // This was 4321, which collided with an unrelated project that had been
    // serving on that port for days; a bare `cargo build` + run then loaded
    // that site inside our window because debug builds read devUrl, not the
    // bundled frontendDist. 4327 is chosen to be out of the way of the usual
    // Astro/Vite default. `strictPort` makes any future collision fail loudly
    // instead of silently serving whatever else holds the port.
    port: 4327,
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
