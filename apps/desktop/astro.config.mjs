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
    //
    // WHY THIS IS HERE.
    //
    // `@dashevo/wasm-sdk` is reached only through a dynamic import() inside
    // dpns-client.ts, so Vite's dependency scanner does not see it when it
    // first walks the statically-imported graph. Vite re-optimizes when the
    // lockfile changes, which wipes node_modules/.vite/deps -- and on the next
    // request the dev-transformed dpns-client.ts still pointed at the OLD
    // hash (`?v=2f92ee44`) of a file that no longer existed. The dev server
    // answered that URL with 504, and the browser reported the failure only as
    // "Importing a module script failed." -- which names neither the module
    // nor the reason.
    //
    // Naming the package here forces it into the optimizer's entry set, so an
    // entry is emitted for it no matter which file is requested first. The
    // production build was never affected, because Rolldown follows dynamic
    // imports and code-splits the bundle itself.
    //
    // If this symptom ever returns after a dependency change, `rm -rf
    // node_modules/.vite` and restart is the immediate remedy; this setting is
    // what stops it being necessary.
    optimizeDeps: {
      include: ['@dashevo/wasm-sdk'],
    },
  },
});
