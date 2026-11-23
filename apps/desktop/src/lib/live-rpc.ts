// apps/desktop/src/lib/live-rpc.ts — Evo Titan
//
// The live client: one DashRpc built from the persisted node config and the
// shipped Tauri transport. This is the seam Phase 1 wires into the screens —
// every call still goes through the pure core (rpc-core.ts), whose envelope
// and error mapping are under test, and out through the Rust proxy
// (src-tauri/src/rpc.rs), because dashd sends no CORS headers and answers an
// OPTIONS preflight with 501 (measured against dashpay/dashd). Nothing here
// reimplements any of that; it only selects it.
//
// When no endpoint is configured this returns null and the pages keep their
// mock behaviour — a page must never fake a live call to have something to
// show (repo rule: a fake transport must never be wired "to make the UI show
// data").

import { DashRpc, tauriTransport } from './rpc';
import { effectiveConfig, type ConfigStorage, type NodeConfig } from './node-config';

/**
 * The live client for the configured endpoint, or null when none is.
 *
 * The password resolution (persisted vs session-only) lives in
 * node-config.ts's effectiveConfig; an empty password reaches the node and
 * comes back as the 401 the core maps to "the node rejected the credentials",
 * which is the correct error for the user to see.
 */
export function liveRpc(storage: ConfigStorage): DashRpc | null {
  const cfg: NodeConfig | null = effectiveConfig(storage);
  if (!cfg) return null;
  return new DashRpc(
    { host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password },
    tauriTransport,
  );
}
