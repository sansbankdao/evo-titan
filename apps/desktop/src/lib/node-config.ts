// apps/desktop/src/lib/node-config.ts — Evo Titan
//
// The connection settings for one real dashd RPC endpoint, persisted in
// localStorage next to Demo Mode (`evotitan.demoMode`) so the same store is
// readable by the app, by `node --test` and by the headless verification
// harness. All of it is pure: storage is injected, which is what lets the
// suite run with an in-memory fake and no DOM.
//
// THE PASSWORD'S TWO HOMES (Phase 1 decision)
// -------------------------------------------
// dashd itself keeps the RPC password in cleartext in the user's own
// dash.conf, so a desktop companion storing it in the app's own storage on the
// same machine is not a downgrade from what the node already does. The Rust
// proxy (src-tauri/src/rpc.rs) takes the credential per call and never logs,
// returns or Debug-prints it. Still, persistence is OPT-IN: the password is
// written to storage only when the user ticks "remember"; otherwise it lives
// in the module for the current session and is gone on restart. The OS keyring
// remains the planned upgrade if the product owner asks for it — this module is
// the single seam to change.
//
// The `data-node="configured"` attribute the pages key off is derived by a
// tiny inline copy of the "is it usable" check in Layout.astro's <head>
// script, because that must run before first paint and cannot import modules.

/** The settings for one dashd JSON-RPC endpoint. */
export interface NodeConfig {
  host: string;
  port: number;
  user: string;
  /** May be '' when the user chose not to persist it; see the header. */
  password: string;
}

/** localStorage key, sibling of `evotitan.demoMode`. */
export const NODE_CONFIG_KEY = 'evotitan.nodeConfig';

/** The minimal storage surface this module needs, so tests need no DOM. */
export interface ConfigStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Testnet RPC port 19998 and mainnet 9998, sourced from
 * src/chainparamsbase.cpp:42-45 (Dash Core v24.0.3), re-verified 2026-11-23.
 * The app defaults to TESTNET per the product decision of 2026-11-23: the
 * shared-masternode pilot runs on testnet first.
 */
export const TESTNET_DEFAULT_PORT = 19998;
export const MAINNET_DEFAULT_PORT = 9998;

/** Is this a port a socket could be opened on? */
function isValidPort(port: unknown): port is number {
  return Number.isInteger(port) && (port as number) >= 1 && (port as number) <= 65535;
}

/**
 * An endpoint worth dialling: host, port and user are present. A missing
 * password is NOT a disqualifier here — it means the call will surface the
 * node's 401 rather than a config error, which is the honest failure to show.
 */
export function isConfigured(cfg: Partial<NodeConfig> | null | undefined): cfg is NodeConfig {
  if (!cfg) return false;
  return (
    typeof cfg.host === 'string' &&
    cfg.host.length > 0 &&
    isValidPort(cfg.port) &&
    typeof cfg.user === 'string' &&
    cfg.user.length > 0 &&
    typeof cfg.password === 'string'
  );
}

/** Parse one stored config. Corrupt or absent storage yields null, never a throw. */
export function parseNodeConfig(raw: string | null): NodeConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NodeConfig>;
    if (
      typeof parsed.host === 'string' &&
      parsed.host.length > 0 &&
      isValidPort(parsed.port) &&
      typeof parsed.user === 'string' &&
      parsed.user.length > 0 &&
      typeof parsed.password === 'string'
    ) {
      return parsed as NodeConfig;
    }
    return null;
  } catch {
    return null;
  }
}

/** Load the persisted config, or null. Never throws, even in private mode. */
export function loadNodeConfig(storage: ConfigStorage): NodeConfig | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(NODE_CONFIG_KEY);
  } catch {
    return null;
  }
  return parseNodeConfig(raw);
}

/** Persist a config. Returns false when storage refused the write. */
export function saveNodeConfig(storage: ConfigStorage, cfg: NodeConfig): boolean {
  if (!isConfigured(cfg)) return false;
  try {
    storage.setItem(NODE_CONFIG_KEY, JSON.stringify(cfg));
    return true;
  } catch {
    return false;
  }
}

/** Forget the persisted endpoint entirely. */
export function clearNodeConfig(storage: ConfigStorage): void {
  try {
    storage.removeItem(NODE_CONFIG_KEY);
  } catch {
    /* nothing to clear */
  }
}

/*
 * The session-only password: held when the user declines "remember", so a
 * configured endpoint keeps working until the app restarts, then asks again.
 */
let sessionPassword: string | null = null;

export function setSessionPassword(pw: string): void {
  sessionPassword = pw;
}

export function clearSessionPassword(): void {
  sessionPassword = null;
}

/**
 * The config a call should use: the persisted one, with the session password
 * filling a password that was deliberately not persisted. Null when no
 * endpoint is configured at all.
 */
export function effectiveConfig(storage: ConfigStorage): NodeConfig | null {
  const persisted = loadNodeConfig(storage);
  if (!persisted) return null;
  if (persisted.password.length > 0 || sessionPassword === null) return persisted;
  return { ...persisted, password: sessionPassword };
}
