// apps/desktop/src/lib/dapi-sansbank.ts — Evo Titan
//
// The adapter for Sansbank's own DAPI proxy, https://dapi.sansbank.dev/v1/dapi
// ("Sansbank DAPI Proxy", openapi v26.1.8, JS-SDK Worker Pool). Measured live
// 2026-11-23 (see fixtures/ for the exact replies):
//
//   - The router speaks SDK method names (snake_case), NOT the public seed's
//     DAPI JSON-RPC camelCase names. `get_status` works; `getStatus` answers
//     "Method 'getStatus' is not supported." — that asymmetry was the bug in
//     our first handoff and is pinned by a test here.
//   - The envelope is {success, method, params, network, result}, and the
//     payload is camelCase with heights as STRINGS and hashes as hex strings —
//     nothing like the seed's {jsonrpc, result:{version:{v0:{…}}}} with byte
//     arrays. The desktop therefore adapts the shape on OUR side (our reply to
//     their team: no seed-compatible mode needed) — this file is that adapter.
//   - CORS: `access-control-allow-origin: *` on both the OPTIONS preflight and
//     the POST (measured with a webview-shaped Origin), so the webview calls it
//     directly, same as the public seed.
//   - The jewel: `chain.coreChainLockedHeight` — the CORE chain height per
//     network, which the public seed's JSON-RPC surface does not offer at all.
//
// Pure: the transport is injected, so the tests run against the captured
// fixtures with no network.

/** The endpoint, as deployed and measured. */
export const SANSBANK_DAPI_URL = 'https://dapi.sansbank.dev/v1/dapi';

/** The networks the proxy serves (its openapi Network enum). */
export type SansbankNetwork = 'mainnet' | 'testnet';

/** The envelope every router method answers with. */
export interface SansbankEnvelope<T> {
  success: boolean;
  method: string;
  params?: unknown[];
  network?: SansbankNetwork;
  result?: T;
  /** Present when success is false. */
  error?: string;
  type?: string;
}

/** result.chain as the proxy returns it (heights are STRINGS except the core one). */
interface SansbankChain {
  catchingUp: boolean;
  latestBlockHeight: string;
  maxPeerBlockHeight: string;
  coreChainLockedHeight: number;
  latestBlockHash: string;
}

/** result.version.software as the proxy returns it. */
interface SansbankSoftware {
  dapi: string;
  drive: string;
  tenderdash: string;
}

/** result.network as the proxy returns it. */
interface SansbankNetworkInfo {
  chainId: string;
  peersCount: number;
  listening: boolean;
}

/** result, as the proxy returns it. */
export interface SansbankStatusResult {
  node: { id: string; proTxHash: string | null };
  chain: SansbankChain;
  version: { software: SansbankSoftware; protocol: unknown };
  network: SansbankNetworkInfo;
  stateSync: unknown;
  time: { local: string; block: string; genesis: string; epoch: number };
}

/** The normalized view the UI renders. */
export interface SansbankStatusView {
  network: SansbankNetwork;
  chainId: string;
  dapiVersion: string;
  driveVersion: string;
  tenderdashVersion: string;
  catchingUp: boolean;
  /** Platform (Tenderdash) height, coerced from the string the proxy sends. */
  platformHeight: number;
  /** Core chain height — the field the public seed does not offer. */
  coreChainLockedHeight: number;
  latestBlockHash: string;
  peersCount: number;
}

/**
 * Parse one get_status envelope into the UI view. Throws with the proxy's own
 * error text when success is false, and refuses a reply that is not for the
 * network we asked about — a network mismatch rendered as the other network's
 * height would be a silent lie.
 */
export function parseSansbankStatus(
  envelope: SansbankEnvelope<SansbankStatusResult>,
  expected: SansbankNetwork,
): SansbankStatusView {
  if (envelope.success !== true || !envelope.result) {
    throw new Error(envelope.error ?? 'the proxy replied success:false without an error');
  }
  if (envelope.network !== expected) {
    throw new Error(`the proxy replied for ${String(envelope.network)} when ${expected} was requested`);
  }
  const r = envelope.result;
  const chain = r.chain;
  const platformHeight = Number.parseInt(chain.latestBlockHeight, 10);
  if (!Number.isFinite(platformHeight) || platformHeight < 0) {
    throw new Error(`unparseable platform height "${chain.latestBlockHeight}"`);
  }
  return {
    network: expected,
    chainId: r.network.chainId,
    dapiVersion: r.version.software.dapi,
    driveVersion: r.version.software.drive,
    tenderdashVersion: r.version.software.tenderdash,
    catchingUp: chain.catchingUp === true,
    platformHeight,
    coreChainLockedHeight: chain.coreChainLockedHeight,
    latestBlockHash: chain.latestBlockHash,
    peersCount: r.network.peersCount,
  };
}

/** The request body for one router call, in the proxy's own SDK naming. */
export function sansbankStatusRequest(network: SansbankNetwork): string {
  return JSON.stringify({ method: 'get_status', params: [], network });
}

/**
 * Fetch and parse one get_status call. The transport is injected so the tests
 * replay the captured fixtures; in the app this is the platform's own fetch —
 * the proxy answers CORS preflights with `access-control-allow-origin: *`
 * (measured 2026-11-23), which is what lets a webview call it at all.
 */
export async function fetchSansbankStatus(
  network: SansbankNetwork,
  transport: (url: string, body: string) => Promise<string>,
  url: string = SANSBANK_DAPI_URL,
): Promise<SansbankStatusView> {
  const raw = await transport(url, sansbankStatusRequest(network));
  let envelope: SansbankEnvelope<SansbankStatusResult>;
  try {
    envelope = JSON.parse(raw) as SansbankEnvelope<SansbankStatusResult>;
  } catch {
    throw new Error('the proxy replied with a body that is not JSON');
  }
  return parseSansbankStatus(envelope, network);
}
